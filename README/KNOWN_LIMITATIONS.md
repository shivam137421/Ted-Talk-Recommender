# Known Limitations & Constraints: TalkWise

This document records the empirical limitations, external constraints, and operational boundaries of the TalkWise application.

---

## 1. Dataset & Recommendation Limitations

### 1.1 Historical Catalog Snapshot (2006–2017)
- The catalog is composed of the Kaggle TED dataset (2,550 talks published up to September 2017).
- View counts (`views`) and comment counts reflect the state of TED.com at the time of scraping in 2017, not live real-time statistics.
- The UI explicitly marks view counts as *"views at dataset snapshot"* to maintain total transparency.

### 1.2 Temporal Interaction Disconnect (Item Cold-Start)
- The Idiap user favorites and comment interaction dataset was crawled up to **September 2012** (1,201 overlapping talks; 134,456 favorites).
- The remaining **1,349 talks published between late 2012 and 2017 have zero collaborative filtering interactions** in the training corpus.
- **Architectural Mitigation:** TalkWise deploys an adaptive hybrid recommender that dynamically falls back to Content-Based Filtering (TF-IDF cosine similarity) for talks lacking collaborative interactions, ensuring catalog-wide coverage.

### 1.3 Positive-Only Implicit Feedback (One-Class Collaborative Filtering)
- The user interaction data consists solely of user favorites (positive implicit feedback).
- The absence of a talk from a user's favorites list indicates **unknown feedback** (unseen or unobserved), not disinterest or negative rating.
- No negative ratings or synthetic views are ever fabricated.

---

## 2. Thumbnail & External Asset Limitations

### 2.1 Thumbnail Hotlinking & Fallback
- The raw datasets contain no images.
- Scraping, downloading, or hosting TED video thumbnails locally is prohibited to respect TED's terms of service and trademark policies.
- In accordance with Checkpoint 0 findings, TED's public oEmbed endpoint (`https://www.ted.com/services/v1/oembed.json?url=<talk_url>`) provides `thumbnail_url` for talks where available.
- **Typographic Fallback:** For talks where oEmbed is unavailable, blocked by network policies, or fails to return an image, TalkWise displays a designed typographic fallback card featuring a warm grey background, the primary topic tag chip, and a subtle TED-red accent rule.

---

## 3. Email & Auth Infrastructure Constraints

### 3.1 Custom Brevo SMTP Delivery with Gmail Sender
- Supabase Auth uses custom SMTP configured with Brevo (`smtp-relay.brevo.com:587`) with sender address `talkwise185@gmail.com`.
- **DMARC / SPF Caveat:** Because `@gmail.com` domains cannot have customized SPF/DKIM DNS records configured on third-party relays like Brevo, recipient email providers (e.g. Gmail, Yahoo, corporate inboxes) may flag automated OTP emails as spam or delay delivery.
- If real email verification is delayed during testing, disposable administrative accounts can be verified directly via the Supabase Admin API for integration testing.

---

## 4. Free-Tier Cloud Hosting Constraints

### 4.1 Cold-Start Inactivity Sleep (Render Free Tier)
- On Render's free tier, compute web services automatically spin down after 15 minutes of inactivity.
- An initial request after a sleep period incurs a 30–50 second cold-start delay while the container spins up.
- **Frontend Mitigation:** The frontend includes an explicit loading indicator explaining that the recommendation service is waking up, and the Express backend provides an immediate database popularity fallback if the ML service does not respond within a configurable timeout.

### 4.2 Supabase 7-Day Inactivity Pause
- Supabase free-tier PostgreSQL projects pause automatically if no database queries are made for 7 consecutive days.
- Data is retained for up to 1 year and can be unpaused from the Supabase dashboard.

