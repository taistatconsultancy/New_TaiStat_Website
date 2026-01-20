# Blog Management System - Setup Guide

## Overview
This blog management system uses:
- **Neon PostgreSQL Database** for storing blog data
- **Cloudinary** for image storage
- **Vercel Serverless Functions** for API endpoints
- **Admin Panel** for managing blogs

## Setup Instructions

### 1. Environment Variables
Add these to your `.env` file (or Vercel environment variables):

```env
# Neon Database
NEON_DATABASE_URL=postgresql://user:password@host/database

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Admin API Key (create a secure random string)
ADMIN_API_KEY=your_secure_random_api_key_here
```

### 2. Database Setup
Run the SQL schema to create the blogs table:

```bash
# Connect to your Neon database and run:
psql $NEON_DATABASE_URL -f database/schema.sql
```

Or copy the SQL from `database/schema.sql` and run it in your Neon dashboard.

### 3. Install Dependencies
```bash
npm install
```

### 4. Migrate Existing Blogs
Run the migration script to transfer existing blog data:

```bash
npm run migrate
```

This will:
- Upload all blog images to Cloudinary
- Insert blog data into the database
- Create slugs for each blog

### 5. Deploy to Vercel
```bash
vercel deploy
```

Make sure to add all environment variables in Vercel dashboard:
- Go to Project Settings → Environment Variables
- Add all variables from step 1

## Usage

### Admin Panel
Access the admin panel at: `https://yourdomain.com/admin/blog-admin.html`

**Note:** The admin panel will prompt for the API key. Use the `ADMIN_API_KEY` you set in environment variables.

### API Endpoints

#### Get All Blogs
```
GET /api/blogs?page=1&limit=10&category=Machine%20Learning
```

#### Get Single Blog by Slug
```
GET /api/blogs?slug=machine-learning
```

#### Get Single Blog by ID
```
GET /api/blogs?id=1
```

#### Create Blog (Admin)
```
POST /api/blogs-admin
Authorization: Bearer YOUR_ADMIN_API_KEY
Content-Type: application/json

{
  "title": "Blog Title",
  "excerpt": "Short excerpt",
  "content": "Full blog content...",
  "featured_image_url": "https://cloudinary.com/image.jpg",
  "author": "Stephen Mulingwa",
  "category": "Machine Learning",
  "tags": ["AI", "ML"],
  "published": true
}
```

#### Update Blog (Admin)
```
PUT /api/blogs-admin?id=1
Authorization: Bearer YOUR_ADMIN_API_KEY
Content-Type: application/json

{
  "title": "Updated Title",
  "content": "Updated content..."
}
```

#### Delete Blog (Admin)
```
DELETE /api/blogs-admin?id=1
Authorization: Bearer YOUR_ADMIN_API_KEY
```

#### Upload Image (Admin)
```
POST /api/upload-image
Authorization: Bearer YOUR_ADMIN_API_KEY
Content-Type: application/json

{
  "image": "data:image/jpeg;base64,..."
}
```

## Blog URLs

- Blog listing: `/blog`
- Blog detail: `/blog/{slug}`

Example: `/blog/machine-learning`

## Features

- ✅ Dynamic blog listing from database
- ✅ SEO-friendly URLs with slugs
- ✅ Image upload to Cloudinary
- ✅ Rich text content support
- ✅ Categories and tags
- ✅ Published/Draft status
- ✅ Admin panel for easy management
- ✅ Responsive design
- ✅ Meta descriptions and keywords

## File Structure

```
├── api/
│   ├── blogs.js              # GET blogs endpoint
│   ├── blogs-admin.js        # POST/PUT/DELETE blogs endpoint
│   └── upload-image.js      # Image upload endpoint
├── admin/
│   └── blog-admin.html       # Admin panel
├── database/
│   └── schema.sql           # Database schema
├── scripts/
│   └── migrate-blogs.js     # Migration script
├── blog.html                # Blog listing page (updated)
└── blog-detail.html         # Blog detail page (dynamic)
```

## Troubleshooting

### Images not uploading
- Check Cloudinary credentials in environment variables
- Verify API key has upload permissions

### Database connection errors
- Verify NEON_DATABASE_URL is correct
- Check SSL settings (should be enabled for Neon)

### API returns 401 Unauthorized
- Verify ADMIN_API_KEY matches in environment variables
- Check Authorization header format: `Bearer YOUR_API_KEY`

### Blogs not showing
- Run migration script to populate database
- Check that blogs have `published: true`
- Verify API endpoint is accessible

## Security Notes

- **Important:** In production, implement proper authentication (JWT, sessions)
- The current API key check is basic - enhance for production use
- Consider rate limiting for API endpoints
- Add input validation and sanitization
- Use HTTPS for all API calls
