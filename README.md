API Endpoints
1. Create a Short URL

POST /shorturls

Body (JSON):

{
  "url": "https://example.com",
  "validity": 10,
  "shortcode": "custom123"
}


Response:

{
  "shortLink": "http://localhost:3000/shorturls/custom123",
  "expiry": "2025-09-04T12:45:00.000Z"
}

2. Redirect to Original URL

GET /shorturls/:code

Redirects to the original URL.

Returns 404 if not found, 410 if expired.


Project completed!!!
