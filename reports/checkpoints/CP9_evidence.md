# Checkpoint 9 Evidence: Deployment Preparation

**Date:** November 17, 2026  
**Checkpoint:** Checkpoint 9 (Deployment Preparation)  
**Status:** **PASS**

---

## 1. Production Artifacts Created
- `Dockerfile.ml`: Multi-stage Docker container for the Python ML microservice running Uvicorn and FastAPI on port 8000, bundling models and clean data.
- `Dockerfile.backend`: Multi-stage Docker container for Node Express backend compiling TypeScript and running on port 5000.
- `vercel.json`: Vercel SPA configuration rewriting `/api/*` to the Render backend service.
- `render.yaml`: Infrastructure-as-code blueprint defining both `talkwise-ml` and `talkwise-backend` services on Render free tier.
- `README/DEPLOYMENT_GUIDE.md`: Step-by-step instructions for 100% free-tier deployment without requiring a credit card.
- `README/LOCAL_SETUP.md`: Comprehensive local setup guide for developers.

