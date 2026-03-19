# MaKames Digital Business Center — cPanel Deployment Guide

## Prerequisites

- cPanel shared hosting with:
  - PHP 8.0 or later
  - MySQL 5.7 / MariaDB 10.3 or later
  - Apache with `mod_rewrite` enabled (standard on most cPanel hosts)

---

## Step 1 — Build the deployment package

From your local machine (or Replit), run:

```bash
bash cpanel/build-for-cpanel.sh
```

This produces a `cpanel-deploy.zip` file ready to upload.

---

## Step 2 — Create the MySQL database

1. Log in to **cPanel**
2. Go to **MySQL Databases**
3. Create a new database — e.g. `youraccount_makames`
4. Create a database user — e.g. `youraccount_dbuser` — with a strong password
5. Add the user to the database with **ALL PRIVILEGES**
6. Open **phpMyAdmin**, select your new database, click **Import**, and upload `install.sql`

---

## Step 3 — Configure the database connection

Edit `config/db.php` and update these four lines:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'youraccount_makames');
define('DB_USER', 'youraccount_dbuser');
define('DB_PASS', 'your-strong-password');
```

---

## Step 4 — Upload to cPanel

1. In **cPanel → File Manager**, navigate to `public_html/`
2. Upload all files from the `cpanel-deploy.zip` archive directly into `public_html/`
   - The file structure should be:
     ```
     public_html/
     ├── .htaccess
     ├── index.html        ← React app entry
     ├── assets/           ← React JS/CSS bundles
     ├── images/           ← static images
     ├── api/
     │   ├── .htaccess
     │   └── index.php     ← PHP API router
     └── config/
         └── db.php        ← database credentials
     ```
3. Make sure `.htaccess` is visible — enable "Show Hidden Files" in File Manager

---

## Step 5 — Verify

Open your domain in a browser. You should see the MaKames Center landing page.

- Test registration at `yourdomain.com/register`
- Test login at `yourdomain.com/login`
- Test the API at `yourdomain.com/api/healthz` — should return `{"status":"ok"}`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank page / 500 error | Check PHP error logs in cPanel → Error Logs |
| API returns 404 | Make sure `mod_rewrite` is enabled; check `.htaccess` is uploaded |
| Database connection failed | Double-check `config/db.php` credentials |
| React routes give 404 | Verify root `.htaccess` is in `public_html/` and has rewrite rules |
| Can't see `.htaccess` | Enable "Show Hidden Files" in File Manager |

---

## Adding More Bot Types

Edit `api/index.php` → find `getBotTypes()` function and add new entries to the array.

## Adjusting Referral Rewards

In `api/index.php`, search for `% 5 === 0` to find the "5 referrals = 3 free days" logic. Change the `5` or `3` as needed.

---

## Security Notes

- The `config/` folder is blocked from direct web access via `.htaccess`
- Change the referral reward logic and pricing in `api/index.php` as needed
- For production, consider adding rate limiting to registration and login endpoints
