# MySQL / MariaDB Dump Import & WooCommerce Schema Invariants

## SQL Dump Syntax Repairs

- **Invalid Binary Defaults**: When importing SQL dumps (e.g. exported from phpMyAdmin or WordFence plugins) into MariaDB 11+, look for invalid default clause syntax `DEFAULT x AS \`000...\``.
- **Correction Pattern**: Do NOT use `--force` to swallow errors. Fix the syntax error directly by converting `DEFAULT x AS \`([0-9a-fA-F]+)\``to standard hex literal`DEFAULT 0x\1`.
- **Import Command**: Import using standard `docker exec -i <container> mariadb -u <user> -p<pass> <db_name> < file.sql`.

## WooCommerce Schema Mapping Quick Reference

- **Orders**: `joy_posts` (`post_type = 'shop_order'`) joined with `joy_postmeta` (`_order_total`, `_billing_first_name`, `_billing_last_name`, `_billing_company`, `_billing_phone`, `_billing_address_1`).
- **Line Items**: `joy_woocommerce_order_items` (`order_item_type = 'line_item'`) joined with `joy_woocommerce_order_itemmeta` (`_qty`, `_line_total`, `_product_id`).
- **Products**: `joy_posts` (`post_type = 'product'`) joined with `joy_postmeta` (`_sku`, `_price`, `_stock`).
