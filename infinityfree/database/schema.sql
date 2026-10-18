CREATE TABLE IF NOT EXISTS `users` (`id` INT AUTO_INCREMENT, `username` VARCHAR(64) NOT NULL UNIQUE, `email` VARCHAR(128) NOT NULL UNIQUE, `pwd` VARCHAR(255) NOT NULL, `avatar` VARCHAR(255) DEFAULT '', `bio` VARCHAR(255) DEFAULT '', `is_official` INT DEFAULT 0, `online` INT DEFAULT 0, `last_seen` BIGINT DEFAULT 0, `last_poll` BIGINT DEFAULT 0, `name_week` VARCHAR(16) DEFAULT '', `name_count` INT DEFAULT 0, `created_at` BIGINT NOT NULL, PRIMARY KEY (`id`));

CREATE TABLE IF NOT EXISTS `verify_codes` (`id` INT AUTO_INCREMENT, `email` VARCHAR(128) NOT NULL, `code` VARCHAR(16) NOT NULL, `purpose` VARCHAR(32) NOT NULL, `expires_at` BIGINT NOT NULL, `used` INT DEFAULT 0, `created_at` BIGINT NOT NULL, PRIMARY KEY (`id`));

CREATE TABLE IF NOT EXISTS `friendships` (`user_id` INT NOT NULL, `friend_id` INT NOT NULL, `remark` VARCHAR(64) DEFAULT '', `created_at` BIGINT NOT NULL, PRIMARY KEY (`user_id`, `friend_id`));

CREATE TABLE IF NOT EXISTS `friend_requests` (`id` INT AUTO_INCREMENT, `from_id` INT NOT NULL, `to_id` INT NOT NULL, `message` VARCHAR(255) DEFAULT '', `status` VARCHAR(16) DEFAULT 'pending', `created_at` BIGINT NOT NULL, PRIMARY KEY (`id`));

CREATE TABLE IF NOT EXISTS `groups` (`id` INT AUTO_INCREMENT, `name` VARCHAR(64) NOT NULL, `avatar` VARCHAR(255) DEFAULT '', `owner_id` INT NOT NULL, `announcement` VARCHAR(255) DEFAULT '', `is_official` INT DEFAULT 0, `im_groupid` VARCHAR(64) DEFAULT '', `created_at` BIGINT NOT NULL, PRIMARY KEY (`id`));

CREATE TABLE IF NOT EXISTS `group_members` (`group_id` INT NOT NULL, `user_id` INT NOT NULL, `role` VARCHAR(16) DEFAULT 'member', `mute_until` BIGINT DEFAULT 0, `dnd` INT DEFAULT 0, `joined_at` BIGINT NOT NULL, PRIMARY KEY (`group_id`, `user_id`));

CREATE TABLE IF NOT EXISTS `messages` (`id` INT AUTO_INCREMENT, `conv_type` VARCHAR(16) NOT NULL, `conv_id` VARCHAR(100) NOT NULL, `sender_id` INT NOT NULL, `msg_type` VARCHAR(16) DEFAULT 'text', `content` VARCHAR(2000) DEFAULT '', `media_url` VARCHAR(1000) DEFAULT '', `media_thumb` VARCHAR(1000) DEFAULT '', `one_time` INT DEFAULT 0, `burn_sec` INT DEFAULT 5, `recalled` INT DEFAULT 0, `extra` VARCHAR(2000) DEFAULT '', `created_at` BIGINT NOT NULL, PRIMARY KEY (`id`));

CREATE TABLE IF NOT EXISTS `message_reads` (`message_id` INT NOT NULL, `user_id` INT NOT NULL, `read_at` BIGINT NOT NULL, PRIMARY KEY (`message_id`, `user_id`));

CREATE TABLE IF NOT EXISTS `message_burns` (`message_id` INT NOT NULL, `user_id` INT NOT NULL, `burned_at` BIGINT NOT NULL, PRIMARY KEY (`message_id`, `user_id`));

CREATE TABLE IF NOT EXISTS `moments` (`id` INT AUTO_INCREMENT, `author_id` INT NOT NULL, `text` VARCHAR(1000) DEFAULT '', `media` VARCHAR(4000) DEFAULT '[]', `visibility` VARCHAR(16) DEFAULT 'public', `allow_ids` VARCHAR(2000) DEFAULT '[]', `deny_ids` VARCHAR(2000) DEFAULT '[]', `deleted` INT DEFAULT 0, `created_at` BIGINT NOT NULL, PRIMARY KEY (`id`));

CREATE TABLE IF NOT EXISTS `moment_likes` (`moment_id` INT NOT NULL, `user_id` INT NOT NULL, `created_at` BIGINT NOT NULL, PRIMARY KEY (`moment_id`, `user_id`));

CREATE TABLE IF NOT EXISTS `moment_comments` (`id` INT AUTO_INCREMENT, `moment_id` INT NOT NULL, `user_id` INT NOT NULL, `content` VARCHAR(500) DEFAULT '', `reply_to_user` INT DEFAULT 0, `deleted` INT DEFAULT 0, `created_at` BIGINT NOT NULL, PRIMARY KEY (`id`));

CREATE TABLE IF NOT EXISTS `dm_dnd` (`user_id` INT NOT NULL, `peer_id` INT NOT NULL, `dnd` INT DEFAULT 0, PRIMARY KEY (`user_id`, `peer_id`));

CREATE TABLE IF NOT EXISTS `conversation_pins` (`user_id` INT NOT NULL, `conv_type` VARCHAR(16) NOT NULL, `conv_id` VARCHAR(100) NOT NULL, `created_at` BIGINT NOT NULL, PRIMARY KEY (`user_id`, `conv_type`, `conv_id`));

CREATE TABLE IF NOT EXISTS `blocks` (`user_id` INT NOT NULL, `blocked_id` INT NOT NULL, `created_at` BIGINT NOT NULL, PRIMARY KEY (`user_id`, `blocked_id`));

CREATE TABLE IF NOT EXISTS `notifications` (`id` INT AUTO_INCREMENT, `user_id` INT NOT NULL, `type` VARCHAR(32) NOT NULL, `actor_id` INT DEFAULT 0, `text` VARCHAR(500) DEFAULT '', `ref_type` VARCHAR(32) DEFAULT '', `ref_id` INT DEFAULT 0, `read` INT DEFAULT 0, `created_at` BIGINT NOT NULL, PRIMARY KEY (`id`));

CREATE TABLE IF NOT EXISTS `events` (`id` INT AUTO_INCREMENT, `user_id` INT NOT NULL, `type` VARCHAR(64) NOT NULL, `data` TEXT NOT NULL, `created_at` BIGINT NOT NULL, PRIMARY KEY (`id`));

CREATE TABLE IF NOT EXISTS `jc_meta` (`name` VARCHAR(64) NOT NULL, `value` VARCHAR(255) DEFAULT '', PRIMARY KEY (`name`));

CREATE INDEX idx_msg_conv ON `messages` (`conv_type`, `conv_id`, `id`);

CREATE INDEX idx_notif_user ON `notifications` (`user_id`, `read`);

CREATE INDEX idx_events_user ON `events` (`user_id`, `id`);

CREATE INDEX idx_verify_email ON `verify_codes` (`email`);
