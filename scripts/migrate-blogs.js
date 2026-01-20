// Migration script to transfer existing blog data to Neon database
require('dotenv').config();
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

// Configure Cloudinary - only if credentials are provided
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};

// Validate Cloudinary config
const hasCloudinaryConfig = cloudinaryConfig.cloud_name && 
                           cloudinaryConfig.api_key && 
                           cloudinaryConfig.api_secret &&
                           cloudinaryConfig.cloud_name !== 'Blog' && // Common mistake
                           cloudinaryConfig.cloud_name.length > 0;

if (hasCloudinaryConfig) {
  cloudinary.config(cloudinaryConfig);
  console.log(`Cloudinary configured with cloud_name: ${cloudinaryConfig.cloud_name.substring(0, 10)}...`);
} else {
  console.warn('Cloudinary not configured. Images will not be uploaded.');
  if (process.env.CLOUDINARY_CLOUD_NAME === 'Blog') {
    console.error('ERROR: CLOUDINARY_CLOUD_NAME is set to "Blog" which is incorrect.');
    console.error('Please check your .env file and set CLOUDINARY_CLOUD_NAME to your actual Cloudinary cloud name.');
  }
}

// Configure pool - Neon requires SSL
const dbUrl = process.env.NEON_DATABASE_URL;
let poolConfig = {
  connectionString: dbUrl
};

// Add SSL config if not already in connection string
if (dbUrl && !dbUrl.includes('sslmode=')) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool(poolConfig);

// Blog data from existing files
const existingBlogs = [
  {
    title: 'Machine Learning',
    slug: 'machine-learning',
    excerpt: 'Dive into the world of Machine Learning and discover how algorithms can transform data into actionable insights.',
    content: `Machine Learning: Unveiling the Predictive Power of the Human Brain

Machine learning represents one of the most transformative technologies of our time, enabling computers to learn from data and make predictions or decisions without being explicitly programmed. At TaiStat, we recognize the profound impact machine learning can have on businesses, research, and everyday life.

Consider a saloonist who can detect early signs of pregnancy simply by touching a client's hair. Years of experience have taught this saloonist to recognize subtle changes in hair texture and scalp condition as indicators of pregnancy. This predictive intuition resembles supervised learning, where the saloonist is "trained" on numerous examples (clients' hair conditions) and associated outcomes (pregnancy).

At TaiStat, we aim to harness the power of machine learning to drive innovation and improve decision-making processes across industries. Through supervised, unsupervised, and reinforcement learning, we are exploring new ways to enhance predictive capabilities and optimize efficiency in complex tasks. Whether through improving customer insights, clustering markets, or optimizing supply chains, TaiStat is setting new standards for actionable data-driven insights.`,
    imagePath: 'blogdetails/blog1.jpg',
    author: 'Stephen Mulingwa',
    category: 'Machine Learning',
    tags: ['Machine Learning', 'AI', 'Data Science'],
    published: true
  },
  {
    title: 'Taistat Consultancy Firm',
    slug: 'taistat-consultancy-firm',
    excerpt: 'Learn how TaiStat Consultancy leverages data science to empower businesses and drive success.',
    content: `Taistat Consultancy Firm: Empowering Businesses Through Data Science

TaiStat Consultancy Firm stands at the forefront of data-driven solutions, helping businesses unlock the power of their data to make informed decisions and drive growth. Our comprehensive approach combines advanced analytics, machine learning, and business intelligence to deliver actionable insights.

We specialize in transforming raw data into strategic advantages, enabling organizations to identify opportunities, optimize operations, and stay ahead in today\'s competitive landscape.`,
    imagePath: 'assets/img/tailogo.png',
    author: 'Stephen Mulingwa',
    category: 'Data Science',
    tags: ['Data Science', 'Consultancy', 'Business Intelligence'],
    published: true
  },
  {
    title: 'Artificial Intelligence',
    slug: 'artificial-intelligence',
    excerpt: 'Uncover the transformative potential of AI and its applications in modern industries.',
    content: `Artificial Intelligence: Transforming Industries

Artificial Intelligence (AI) is revolutionizing how businesses operate, making processes more efficient and enabling new capabilities that were once thought impossible. From predictive analytics to automated decision-making, AI is reshaping industries across the board.

At TaiStat, we help organizations understand and implement AI solutions that drive real business value.`,
    imagePath: 'blogdetails/blog2.jpg',
    author: 'Stephen Mulingwa',
    category: 'Artificial Intelligence',
    tags: ['AI', 'Technology', 'Innovation'],
    published: true
  },
  {
    title: 'The Innovation Framework: Driving Success Through Tailored Strategies',
    slug: 'innovation-framework-driving-success-through-tailored-strategies',
    excerpt: 'Explore strategies tailored for success in today\'s competitive market landscape.',
    content: `The Innovation Framework: Driving Success Through Tailored Strategies

Innovation is the lifeblood of modern business success. At TaiStat, we\'ve developed a comprehensive framework that helps organizations identify opportunities, develop tailored strategies, and execute with precision.

Our innovation framework combines data-driven insights with strategic thinking to create solutions that are both innovative and practical.`,
    imagePath: 'blogdetails/blog4.jpg',
    author: 'Stephen Mulingwa',
    category: 'Technology',
    tags: ['Innovation', 'Strategy', 'Business'],
    published: true
  },
  {
    title: 'Transforming Sales with the Footwear Sales App',
    slug: 'transforming-sales-with-footwear-sales-app',
    excerpt: 'Discover how innovative apps are revolutionizing sales processes for businesses.',
    content: `Transforming Sales with the Footwear Sales App

TaiStat Consultancy has achieved remarkable success with its innovative Footwear Sales App, a comprehensive sales management solution for small and medium businesses. This app empowers both business owners and sales teams by offering two tailored interfaces: the Update App and the Summary App.

The Update App streamlines daily sales entry, stock updates, and expense tracking, making it easy for sales staff to track performance and generate receipts for transactions. Meanwhile, the Summary App provides business owners with real-time insights, enabling them to monitor total investment, stock levels, profit margins, and trends in sales data.`,
    imagePath: 'blogdetails/blog5.png',
    author: 'Stephen Mulingwa',
    category: 'Sales',
    tags: ['Sales', 'Mobile App', 'Business Solutions'],
    published: true
  },
  {
    title: 'Survey Application: Simplifying Data Collection and Enhancing Insights for Businesses',
    slug: 'survey-application-simplifying-data-collection',
    excerpt: 'Streamline your data gathering with our comprehensive survey application solution.',
    content: `Survey Application: Simplifying Data Collection

Effective data collection is crucial for making informed business decisions. Our survey application provides a comprehensive solution for gathering, analyzing, and acting on customer feedback and market research data.

The application offers intuitive interfaces for creating surveys, collecting responses, and generating actionable insights that drive business growth.`,
    imagePath: 'blogdetails/blog6.jpg',
    author: 'Stephen Mulingwa',
    category: 'Data Collection',
    tags: ['Data Collection', 'Surveys', 'Research'],
    published: true
  },
  {
    title: 'Unlocking the Power of APIs with TaiStat Consultancy Firm',
    slug: 'unlocking-power-of-apis',
    excerpt: 'Harness the power of APIs to enable seamless data integration and drive innovation.',
    content: `Unlocking the Power of APIs

APIs (Application Programming Interfaces) are the backbone of modern software integration, enabling different systems to communicate and share data seamlessly. At TaiStat, we help businesses leverage APIs to create more connected, efficient, and innovative solutions.

Our expertise in API development and integration helps organizations unlock new capabilities and streamline their operations.`,
    imagePath: 'blogdetails/blog7.jpg',
    author: 'Stephen Mulingwa',
    category: 'APIs',
    tags: ['APIs', 'Integration', 'Development'],
    published: true
  },
  {
    title: 'Why Every Business Needs a Data-Driven Strategy Today',
    slug: 'why-every-business-needs-data-driven-strategy',
    excerpt: 'Understand the critical role of data-driven strategies in today\'s evolving business landscape.',
    content: `Why Every Business Needs a Data-Driven Strategy Today

In today\'s competitive business environment, data-driven decision-making is no longer optional—it\'s essential. Businesses that leverage data effectively gain significant advantages in understanding their customers, optimizing operations, and identifying new opportunities.

At TaiStat, we help organizations develop comprehensive data strategies that transform how they operate and compete in the market.`,
    imagePath: 'blogdetails/data.jpg',
    author: 'Stephen Mulingwa',
    category: 'Data Science',
    tags: ['Data Strategy', 'Business Intelligence', 'Analytics'],
    published: true
  }
];

async function uploadImageToCloudinary(imagePath) {
  // Skip upload if Cloudinary is not configured
  if (!hasCloudinaryConfig) {
    return null;
  }

  try {
    const fullPath = path.join(__dirname, '..', imagePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`Image not found: ${fullPath}, skipping upload`);
      return null;
    }

    const result = await cloudinary.uploader.upload(fullPath, {
      folder: 'taistat-blogs',
      resource_type: 'auto'
    });

    return result.secure_url;
  } catch (error) {
    console.error(`Error uploading ${imagePath}:`, error.message);
    return null;
  }
}

async function migrateBlogs() {
  try {
    // Check environment variables
    if (!process.env.NEON_DATABASE_URL) {
      console.error('Error: NEON_DATABASE_URL is not set in environment variables');
      console.error('Please create a .env file with NEON_DATABASE_URL');
      process.exit(1);
    }

    // Check Cloudinary config
    if (!hasCloudinaryConfig) {
      console.warn('Warning: Cloudinary credentials not properly set. Images will not be uploaded.');
      console.warn('Please set the following in your .env file:');
      console.warn('  CLOUDINARY_CLOUD_NAME=your_actual_cloud_name');
      console.warn('  CLOUDINARY_API_KEY=your_api_key');
      console.warn('  CLOUDINARY_API_SECRET=your_api_secret');
      console.warn('');
      console.warn('Note: CLOUDINARY_CLOUD_NAME should be your Cloudinary cloud name, not "Blog"');
    }

    console.log('Starting blog migration...');
    console.log(`Database: ${process.env.NEON_DATABASE_URL.substring(0, 30)}...`);

    for (const blog of existingBlogs) {
      console.log(`Migrating: ${blog.title}`);
      
      // Upload image to Cloudinary
      let imageUrl = null;
      if (blog.imagePath) {
        imageUrl = await uploadImageToCloudinary(blog.imagePath);
        console.log(`  Image uploaded: ${imageUrl || 'Failed'}`);
      }

      // Insert into database
      const result = await pool.query(
        `INSERT INTO blogs (title, slug, excerpt, content, featured_image_url, author, category, tags, published, created_at, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (slug) DO UPDATE SET
           title = EXCLUDED.title,
           excerpt = EXCLUDED.excerpt,
           content = EXCLUDED.content,
           featured_image_url = EXCLUDED.featured_image_url,
           category = EXCLUDED.category,
           tags = EXCLUDED.tags
         RETURNING id, title`,
        [blog.title, blog.slug, blog.excerpt, blog.content, imageUrl, blog.author, blog.category, blog.tags, blog.published]
      );

      console.log(`  ✓ Migrated: ${result.rows[0].title} (ID: ${result.rows[0].id})`);
    }

    console.log('\nMigration completed successfully!');
    await pool.end();
  } catch (error) {
    console.error('Migration error:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run migration
migrateBlogs();
