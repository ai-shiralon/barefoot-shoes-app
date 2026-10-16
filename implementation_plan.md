# Deploy Barefoot Shoes App to Vercel via GitHub

The goal of this plan is to deploy your existing React & Express application to Vercel. Since Vercel uses a serverless architecture, we need to adapt your backend to work in a serverless environment.

## Background Context
Currently, your app uses a local Express server (`server.ts`) which stores order data and configuration inside local JSON files (`data/orders.json` and `data/google-config.json`). 
Vercel serverless functions have a **read-only and temporary filesystem**, which means any data saved to local files will be lost almost immediately. 

## User Review Required

> [!WARNING]  
> **Data Persistence Strategy**
> Since local files won't work on Vercel, we need a replacement for `orders.json`. I propose setting up **Vercel KV** (a Redis database built into Vercel). This will allow your admin panel to continue working exactly as it does now, storing orders persistently on Vercel. 
> 
> Alternatively, if you only care about Google Sheets, we can bypass local storage entirely, but your admin panel on the app will no longer show a history of orders unless it fetches directly from Google Sheets.
> 
> **Are you okay with using Vercel KV for data storage?**

## Open Questions

> [!IMPORTANT]  
> 1. What would you like to name the GitHub repository? (e.g., `barefoot-shoes-app`)
> 2. Is Vercel CLI and GitHub CLI (`gh`) already authenticated on your machine?

## Proposed Changes

### 1. Backend Migration (Vercel Serverless)
We will wrap your existing Express app to run as a single Vercel Serverless Function, or split the routes into Vercel's standard `api/` folder structure.
- Create an `api/index.ts` file that uses `@vercel/node` to run your Express `app`.
- Update your data fetching/saving logic to use `@vercel/kv` instead of `fs.readFileSync` and `fs.writeFileSync`.

### 2. GitHub Integration
- Initialize a Git repository in your project folder.
- Create a `.gitignore` (if not already fully configured).
- Commit the current code.
- Create a new repository on your GitHub account using the GitHub CLI (`gh repo create`).
- Push the code to GitHub.

### 3. Vercel Deployment
- Link the project to Vercel via the Vercel CLI (`vercel link`).
- Configure the GitHub integration so every push automatically deploys to Vercel (`vercel git connect`).
- Provision a Vercel KV database and link it to the project so the environment variables are injected automatically.
- Deploy the production build.

## Verification Plan

### Automated Tests
- Run `npm run build` locally to ensure the Vite build succeeds.

### Manual Verification
- Access the Vercel deployment URL.
- Submit a test order on the live site.
- Verify the test order appears in the Vercel KV datastore and is sent to Google Sheets (if configured).
- Verify the Admin Panel loads orders correctly on the live Vercel domain.
