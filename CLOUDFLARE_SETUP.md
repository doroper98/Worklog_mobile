# Cloudflare Pages Setup Guide

Workwiki Mobile PWA deployment guide.

---

## 1. Prerequisites

- Cloudflare account: https://dash.cloudflare.com/sign-up
- GitHub repository: `doroper98/workwiki-mobile` (Private)

## 2. Connect GitHub Repository

1. Go to Cloudflare Dashboard → **Workers & Pages** → **Create**
2. Select **Pages** → **Connect to Git**
3. Authorize Cloudflare to access your GitHub account
4. Select `doroper98/workwiki-mobile` repository

## 3. Build Settings

| Setting | Value |
|---------|-------|
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Node.js version | 18+ |

### Environment Variables (if needed)

None required. The app uses client-side GitHub PAT stored in localStorage.

## 4. Deploy

1. Click **Save and Deploy**
2. First build takes ~1-2 minutes
3. Default URL: `https://workwiki-mobile.pages.dev`

## 5. Custom Domain (Optional)

1. Go to project → **Custom domains**
2. Add your domain
3. Cloudflare handles SSL automatically

## 6. Automatic Deployments

Every `git push origin main` triggers:

```
push → Cloudflare detects change → npm install → npm run build → deploy dist/
```

Average deploy time: 1-2 minutes.

## 7. Verify Deployment

1. Visit `https://workwiki-mobile.pages.dev`
2. Confirm HTTPS (padlock icon)
3. Open DevTools → Application → Manifest → verify PWA info
4. Try "Add to Home Screen" on mobile

## 8. Troubleshooting

- **Build fails**: Check `npm run build` works locally first
- **404 on routes**: SPA routing — add `_redirects` file if needed:
  ```
  /*  /index.html  200
  ```
- **Cache issues**: Cloudflare Pages purges cache on each deploy automatically
