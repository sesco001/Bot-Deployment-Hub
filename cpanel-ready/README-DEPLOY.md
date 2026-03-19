# MaKames Digital Business Center — cPanel Deployment Files

> **These are the READY-TO-UPLOAD files. Upload everything in this folder directly to `public_html/`.**

---

## What's in this folder

```
cpanel-ready/
├── index.html          ← React app entry point
├── favicon.svg
├── opengraph.jpg
├── assets/             ← Compiled JavaScript & CSS (do not edit)
├── images/             ← Site images
├── api/
│   ├── index.php       ← PHP backend — handles all API calls
│   └── .htaccess
├── config/
│   └── db.php          ← EDIT THIS with your MySQL credentials
├── .htaccess           ← Apache routing — required, do not delete
└── install.sql         ← MySQL schema — import once in phpMyAdmin
```

---

## Step 1 — Create MySQL Database

1. Log into **cPanel → MySQL Databases**
2. Create a new database (e.g. `youraccount_makames`)
3. Create a database user with a strong password
4. Give that user **ALL PRIVILEGES** on the database
5. Open **phpMyAdmin**, select your new database, click **Import**, upload `install.sql`

---

## Step 2 — Edit Database Credentials

Open `config/db.php` and fill in your MySQL details:

```php
define('DB_HOST', 'localhost');
define('DB_NAME', 'youraccount_makames');   // your database name
define('DB_USER', 'youraccount_dbuser');    // your database username
define('DB_PASS', 'your-strong-password');  // your database password
```

---

## Step 3 — Upload Files to cPanel

1. Go to **cPanel → File Manager** → open `public_html/`
2. Enable **"Show Hidden Files"** (Settings button, top right)
3. Upload **ALL** files from this folder into `public_html/`
   - `.htaccess` must be uploaded — it won't show unless hidden files are enabled
4. Final structure in `public_html/`:
   ```
   public_html/
   ├── .htaccess
   ├── index.html
   ├── assets/
   ├── images/
   ├── favicon.svg
   ├── api/
   │   ├── .htaccess
   │   └── index.php
   └── config/
       └── db.php
   ```

---

## Step 4 — Test

- Visit `yourdomain.com` → landing page should appear
- Visit `yourdomain.com/api/healthz` → should return `{"status":"ok"}`
- Register at `yourdomain.com/register`

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Blank/white page | `.htaccess` was not uploaded — enable "Show Hidden Files" and re-upload |
| 500 error | Check **cPanel → Error Logs** for PHP errors |
| Database error | Re-check the credentials in `config/db.php` |
| Pages give 404 | Confirm Apache `mod_rewrite` is enabled on your host |
| API returns 404 | Make sure `api/.htaccess` was also uploaded |

---

## Customisation

**Change bot prices** — Edit `api/index.php` → find `getBotTypes()`

**Change referral reward** — Edit `api/index.php` → search for `% 5 === 0` (5 referrals) and `free_deploy_days_left = 3` (3 free days)
