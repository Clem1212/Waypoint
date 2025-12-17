const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3030;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper function to extract image from a page
async function extractImageFromUrl(url, source) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 5000
    });
    
    const $ = cheerio.load(response.data);
    
    // Try Open Graph image first
    let image = $('meta[property="og:image"]').attr('content');
    
    // Try Twitter card image
    if (!image) {
      image = $('meta[name="twitter:image"]').attr('content');
    }
    
    // Try article image
    if (!image) {
      image = $('article img, .article img').first().attr('src');
    }
    
    // Make sure image URL is absolute
    if (image && !image.startsWith('http')) {
      const urlObj = new URL(url);
      image = `${urlObj.protocol}//${urlObj.host}${image.startsWith('/') ? '' : '/'}${image}`;
    }
    
    return image || '';
  } catch (error) {
    console.error(`Error extracting image from ${url}:`, error.message);
    return '';
  }
}

// YouTube scraper with thumbnails
async function scrapeYouTube(query) {
  try {
    const response = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    
    const videos = [];
    const scriptTags = $('script').toArray();
    
    for (let script of scriptTags) {
      const content = $(script).html();
      if (content && content.includes('var ytInitialData')) {
        const jsonStr = content.split('var ytInitialData = ')[1].split(';')[0];
        try {
          const data = JSON.parse(jsonStr);
          const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];
          
          for (let item of contents.slice(0, 6)) {
            if (item.videoRenderer) {
              const video = item.videoRenderer;
              const thumbnails = video.thumbnail?.thumbnails || [];
              // Get highest quality thumbnail
              const thumbnail = thumbnails.length > 0 ? thumbnails[thumbnails.length - 1].url : '';
              
              videos.push({
                title: video.title?.runs?.[0]?.text || 'No title',
                url: `https://www.youtube.com/watch?v=${video.videoId}`,
                thumbnail: thumbnail,
                source: 'YouTube'
              });
            }
          }
          break;
        } catch (e) {
          continue;
        }
      }
    }
    
    return videos;
  } catch (error) {
    console.error('YouTube scrape error:', error.message);
    return [];
  }
}

// TikTok scraper (mock with proper structure)
async function scrapeTikTok(query) {
  return [
    {
      title: `${query} trending on TikTok`,
      url: `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
      thumbnail: 'https://via.placeholder.com/640x360/000000/FFFFFF?text=TikTok',
      source: 'TikTok'
    },
    {
      title: `${query} viral content`,
      url: `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
      thumbnail: 'https://via.placeholder.com/640x360/000000/FFFFFF?text=TikTok',
      source: 'TikTok'
    },
    {
      title: `Latest ${query} videos`,
      url: `https://www.tiktok.com/search?q=${encodeURIComponent(query)}`,
      thumbnail: 'https://via.placeholder.com/640x360/000000/FFFFFF?text=TikTok',
      source: 'TikTok'
    }
  ];
}

// Instagram scraper (mock with proper structure)
async function scrapeInstagram(query) {
  const tag = query.replace(/\s+/g, '').toLowerCase();
  return [
    {
      title: `#${tag} on Instagram`,
      url: `https://www.instagram.com/explore/tags/${tag}/`,
      thumbnail: 'https://via.placeholder.com/640x360/E4405F/FFFFFF?text=Instagram',
      source: 'Instagram'
    },
    {
      title: `${query} posts and reels`,
      url: `https://www.instagram.com/explore/tags/${tag}/`,
      thumbnail: 'https://via.placeholder.com/640x360/E4405F/FFFFFF?text=Instagram',
      source: 'Instagram'
    },
    {
      title: `Explore ${query} content`,
      url: `https://www.instagram.com/explore/tags/${tag}/`,
      thumbnail: 'https://via.placeholder.com/640x360/E4405F/FFFFFF?text=Instagram',
      source: 'Instagram'
    }
  ];
}

// Twitch scraper (mock with proper structure)
async function scrapeTwitch(query) {
  return [
    {
      title: `${query} live streams on Twitch`,
      url: `https://www.twitch.tv/search?term=${encodeURIComponent(query)}`,
      thumbnail: 'https://via.placeholder.com/640x360/9146FF/FFFFFF?text=Twitch',
      source: 'Twitch'
    },
    {
      title: `Watch ${query} gameplay`,
      url: `https://www.twitch.tv/search?term=${encodeURIComponent(query)}`,
      thumbnail: 'https://via.placeholder.com/640x360/9146FF/FFFFFF?text=Twitch',
      source: 'Twitch'
    },
    {
      title: `${query} streamers and clips`,
      url: `https://www.twitch.tv/search?term=${encodeURIComponent(query)}`,
      thumbnail: 'https://via.placeholder.com/640x360/9146FF/FFFFFF?text=Twitch',
      source: 'Twitch'
    }
  ];
}

// Enhanced news scraper with fallback mock data
async function scrapeNews(source, query, location = '') {
  console.log(`Scraping ${source} for query: ${query}, location: ${location}`);
  const results = [];
  
  try {
    let url = '';
    let baseUrl = '';
    
    switch(source) {
      case 'cnn':
        baseUrl = 'https://www.cnn.com';
        url = query ? 
          `${baseUrl}/search?q=${encodeURIComponent(query)}` : 
          baseUrl;
        break;
      case 'fox':
        baseUrl = 'https://www.foxnews.com';
        url = query ? 
          `${baseUrl}/search-results/search?q=${encodeURIComponent(query)}` : 
          baseUrl;
        break;
      case 'bbc':
        baseUrl = 'https://www.bbc.com';
        url = query ? 
          `${baseUrl}/search?q=${encodeURIComponent(query)}` : 
          `${baseUrl}/news`;
        break;
      default:
        return results;
    }
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    
    // Try multiple selectors for each site
    const selectors = {
      cnn: [
        { article: '.container__item', title: '.container__title', link: 'a', img: 'img' },
        { article: '.card', title: 'h3', link: 'a', img: 'img' },
        { article: 'article', title: 'h2, h3', link: 'a', img: 'img' }
      ],
      fox: [
        { article: 'article.article', title: 'h2.title, h3', link: 'a', img: 'img' },
        { article: '.content-list article', title: 'h4, h3', link: 'a', img: 'img' },
        { article: '.collection-article-list article', title: 'h2, h3', link: 'a', img: 'img' }
      ],
      bbc: [
        { article: '[data-testid="card"]', title: 'h3', link: 'a', img: 'img' },
        { article: 'article', title: 'h3, h2', link: 'a', img: 'img' },
        { article: '.gel-layout__item', title: 'h3', link: 'a', img: 'img' }
      ]
    };
    
    const sourceSelectors = selectors[source] || [];
    
    for (const selector of sourceSelectors) {
      if (results.length >= 5) break;
      
      $(selector.article).slice(0, 8).each((i, elem) => {
        if (results.length >= 5) return;
        
        const $elem = $(elem);
        const title = $elem.find(selector.title).first().text().trim();
        let link = $elem.find(selector.link).first().attr('href');
        let thumbnail = $elem.find(selector.img).first().attr('src') || 
                       $elem.find(selector.img).first().attr('data-src') ||
                       $elem.find(selector.img).first().attr('data-lazy-src');
        
        if (title && link && title.length > 10) {
          // Make link absolute
          if (!link.startsWith('http')) {
            link = link.startsWith('/') ? `${baseUrl}${link}` : `${baseUrl}/${link}`;
          }
          
          // Make thumbnail absolute
          if (thumbnail && !thumbnail.startsWith('http') && !thumbnail.startsWith('data:')) {
            thumbnail = thumbnail.startsWith('/') ? `${baseUrl}${thumbnail}` : `${baseUrl}/${thumbnail}`;
          }
          
          // Filter out bad thumbnails
          if (thumbnail && (thumbnail.includes('data:image') || thumbnail.length > 500)) {
            thumbnail = '';
          }
          
          // Check if we already have this article
          const isDuplicate = results.some(r => r.title === title || r.url === link);
          if (!isDuplicate) {
            results.push({
              title: title,
              url: link,
              thumbnail: thumbnail || '',
              source: source.toUpperCase()
            });
          }
        }
      });
    }
    
    console.log(`Found ${results.length} results from ${source}`);
    
  } catch (error) {
    console.error(`${source} scrape error:`, error.message);
  }
  
  // If scraping failed or returned no results, return fallback mock data
  if (results.length === 0) {
    console.log(`Using fallback data for ${source}`);
    const fallbackData = getMockNewsData(source, query, location);
    return fallbackData;
  }
  
  return results;
}

// Fallback mock news data
function getMockNewsData(source, query, location) {
  const locationText = location ? ` in ${location}` : '';
  const baseData = {
    cnn: {
      thumbnail: 'https://via.placeholder.com/640x360/CC0000/FFFFFF?text=CNN',
      articles: [
        `Breaking: ${query} developments${locationText}`,
        `Analysis: Understanding ${query}`,
        `${query} impact on communities`,
        `Latest updates on ${query}`,
        `Experts weigh in on ${query}`
      ]
    },
    fox: {
      thumbnail: 'https://via.placeholder.com/640x360/003366/FFFFFF?text=Fox+News',
      articles: [
        `${query} situation unfolds${locationText}`,
        `What you need to know about ${query}`,
        `${query}: Key takeaways`,
        `Breaking coverage: ${query}`,
        `${query} update: Full story`
      ]
    },
    bbc: {
      thumbnail: 'https://via.placeholder.com/640x360/000000/FFFFFF?text=BBC',
      articles: [
        `${query}: What's happening${locationText}`,
        `${query} explained`,
        `The story behind ${query}`,
        `${query}: Latest developments`,
        `In-depth: ${query} coverage`
      ]
    }
  };
  
  const sourceData = baseData[source];
  if (!sourceData) return [];
  
  return sourceData.articles.map((title, index) => ({
    title: title,
    url: source === 'cnn' ? 'https://www.cnn.com' : 
         source === 'fox' ? 'https://www.foxnews.com' : 
         'https://www.bbc.com/news',
    thumbnail: sourceData.thumbnail,
    source: source.toUpperCase()
  }));
}

// API Routes
app.get('/api/search', async (req, res) => {
  const { query, location } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }
  
  console.log(`\n=== New Search Request ===`);
  console.log(`Query: ${query}`);
  console.log(`Location: ${location || 'none'}`);
  
  try {
    // Run all scrapers in parallel for better performance
    const [youtube, tiktok, instagram, twitch, cnn, fox, bbc] = await Promise.all([
      scrapeYouTube(query),
      scrapeTikTok(query),
      scrapeInstagram(query),
      scrapeTwitch(query),
      scrapeNews('cnn', query, location),
      scrapeNews('fox', query, location),
      scrapeNews('bbc', query, location)
    ]);
    
    const results = {
      social: {
        youtube: youtube,
        tiktok: tiktok,
        instagram: instagram,
        twitch: twitch
      },
      news: {
        cnn: cnn,
        fox: fox,
        bbc: bbc
      }
    };
    
    console.log(`\n=== Results Summary ===`);
    console.log(`YouTube: ${youtube.length} videos`);
    console.log(`TikTok: ${tiktok.length} items`);
    console.log(`Instagram: ${instagram.length} items`);
    console.log(`Twitch: ${twitch.length} items`);
    console.log(`CNN: ${cnn.length} articles`);
    console.log(`Fox: ${fox.length} articles`);
    console.log(`BBC: ${bbc.length} articles`);
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Prism server running on http://localhost:${PORT}`);
  console.log(`📱 Open http://localhost:${PORT} to use the app\n`);
});