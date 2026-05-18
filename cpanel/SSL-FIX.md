# Fix SSL “Dangerous” / certificate errors

cPanel may show **SSL: Active** while browsers still warn. That usually means the certificate **does not match** `ehealthaigh.com` (wrong hostname on the cert).

## Fix in cPanel

1. **SSL/TLS** → **Manage SSL Sites**
2. Select **`ehealthaigh.com`** (and **`www.ehealthaigh.com`** if you use www)
3. Click **Run AutoSSL** or **Install** Let’s Encrypt for that exact domain
4. Wait 5–15 minutes, then test in an **Incognito** window:  
   https://ehealthaigh.com

## Checklist

| Check | Action |
|-------|--------|
| Cert is for your domain | View certificate — **Common Name** or **SAN** must include `ehealthaigh.com` |
| Not only server hostname | Reject certs only valid for `*.stormerhost.com` or the server name |
| www + non-www | Issue cert for both, or redirect one to the other in **Domains** |
| Still “Dangerous” | [Google Safe Browsing](https://transparencyreport.google.com/safe-browsing/search) — request review if flagged |

## Until HTTPS is trusted

Use **http://ehealthaigh.com/admin** for admin login (API works the same once Node is running).

After SSL is correct, use **https://** everywhere and keep `ALLOWED_ORIGINS` including both `http` and `https` during transition.
