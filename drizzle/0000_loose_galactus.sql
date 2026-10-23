CREATE TABLE `addresses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`street` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`zip` text NOT NULL,
	`lat` real,
	`lng` real,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `addresses_user` ON `addresses` (`user_id`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `events_order` ON `order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`image` text NOT NULL,
	`unit` text NOT NULL,
	`price` integer NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`order_id`, `product_id`),
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`address` text NOT NULL,
	`subtotal` integer NOT NULL,
	`delivery` integer NOT NULL,
	`tax` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`status` text DEFAULT 'Placed' NOT NULL,
	`payment` text DEFAULT 'cash' NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`partner_id` text,
	`otp` text NOT NULL,
	`lat` real,
	`lng` real,
	`location_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`payment_session` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`partner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `orders_workspace_status` ON `orders` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `orders_user` ON `orders` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_idempotency` ON `orders` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `products` (
	`workspace_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`image` text NOT NULL,
	`price` integer NOT NULL,
	`original_price` integer NOT NULL,
	`unit` text NOT NULL,
	`stock` integer NOT NULL,
	`organic` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`workspace_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `products_category` ON `products` (`workspace_id`,`category`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`email` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`vehicle` text DEFAULT 'bike' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email` ON `users` (`workspace_id`,`email`);--> statement-breakpoint
CREATE INDEX `users_workspace` ON `users` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER reserve_order_stock BEFORE INSERT ON order_items BEGIN
 SELECT CASE WHEN NEW.quantity <= 0 OR NOT EXISTS (
  SELECT 1 FROM products p JOIN orders o ON o.workspace_id=p.workspace_id
  WHERE o.id=NEW.order_id AND p.id=NEW.product_id AND p.active=1 AND p.stock>=NEW.quantity
 ) THEN RAISE(ABORT, 'insufficient_stock') END;
 UPDATE products SET stock=stock-NEW.quantity WHERE id=NEW.product_id AND workspace_id=(SELECT workspace_id FROM orders WHERE id=NEW.order_id);
END;
--> statement-breakpoint
CREATE TRIGGER restore_cancelled_stock AFTER UPDATE OF status ON orders
WHEN NEW.status='Cancelled' AND OLD.status!='Cancelled' BEGIN
 UPDATE products SET stock=stock+COALESCE((SELECT quantity FROM order_items WHERE order_id=NEW.id AND product_id=products.id),0)
 WHERE workspace_id=NEW.workspace_id AND id IN (SELECT product_id FROM order_items WHERE order_id=NEW.id);
END;
--> statement-breakpoint
CREATE TRIGGER audit_order_status AFTER UPDATE OF status ON orders
WHEN NEW.status!=OLD.status BEGIN
 INSERT INTO order_events(id,order_id,status,created_at,note) VALUES (lower(hex(randomblob(16))),NEW.id,NEW.status,NEW.updated_at,'');
END;
