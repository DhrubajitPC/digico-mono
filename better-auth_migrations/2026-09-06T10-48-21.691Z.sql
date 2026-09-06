alter table `user` add column `banned` boolean default false;

alter table `user` add column `banReason` text;

alter table `user` add column `banExpires` timestamp(3);

alter table `session` add column `impersonatedBy` text;