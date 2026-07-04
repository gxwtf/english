# Project Architecture

## Overview
This project is a Next.js application (App Router) built with TypeScript. It integrates AI capabilities for question generation, OCR for image recognition, and a custom dictionary system. It uses Prisma as its ORM and features a custom SSO-based authentication system.

## Core Technologies
- **Framework**: Next.js (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **AI**: OpenAI API (via custom wrapper and queue)
- **OCR**: PaddleOCR (Python microservice)
- **UI**: React, Tailwind CSS, Shadcn UI

## Database Schema (Prisma)
The database schema is defined in `prisma/schema.prisma` and includes the following key models:
- **User**: Stores user information synced from SSO (`userId`, `userName`, `admin`, etc.).
- **Word**: Stores user-specific words, their meanings (JSON), and related words (JSON).
- **QuestionQueue**: Stores generated questions, their status, grading results, and associated word IDs.
- **Tag & WordTag**: A many-to-many relationship allowing users to categorize words.
- **RelatedWord**: Stores relationships between words (e.g., 'different_form', 'easily_confused').
- **TagConfig**: User-specific tag configurations (name, color, description).

## Key Workflows

### Authentication (SSO)
1. **Login**: The route `src/app/api/auth/login/route.ts` redirects users to the external GXAccount SSO login page (`https://account.gxwtf.cn/sso/login`). It passes the current host as the `system` parameter and the return URL as the `back` parameter.
2. **Callback**: The route `src/app/sso/callback/route.ts` handles the SSO callback. It verifies the token with the GXAccount API (`/sso/verify`).
3. **Session**: Upon successful verification, it sets an HTTP-only cookie (`gxwtf_auth`) containing user info (userId, userName, admin, email, realName) for 7 days.

### Dictionary System
- **Data Source**: Uses a CSV file (`dict/ecdict.csv`) loaded by `src/lib/dict/ecdict.ts` (`DictCsv` class) into an in-memory map.
- **Parsing**: The `DictCsv` class manually parses CSV lines to handle quotes and decodes escaped characters (`\n`, `\r`, `\\`).
- **Querying**: `src/lib/dict/query.ts` provides a `query` function. It looks up a word, parses its translation, and splits it into structured `Meaning` objects (type and content). The `DictCsv` class parses translations by splitting them by newline and matching a regex for parts of speech (e.g., `n.`, `adj.`).
- **Batch Updates**: `scripts/batch-update-meanings.ts` is a maintenance script that iterates through all words in the database, queries the dictionary, and updates the `meanings` JSON field in the database to match the dictionary format.

### AI Integration
- **API Wrapper**: `src/lib/openai.ts` provides a robust wrapper for OpenAI API calls. It supports multiple model configurations, automatic retries, timeouts, and fallback models.
- **Queue Management**: `src/lib/ai-queue.ts` (`AIRequestQueue`) limits concurrent AI requests to prevent rate limiting (default concurrency: 3).
- **Question Generation**: Server actions in `src/actions/ai-question/` use these utilities to generate various types of questions (fill-blank, translate, word-card, etc.) based on user-selected words.

### Word Selection Logic
- `src/lib/word-selection.ts` contains the logic for selecting words for question generation.
- It handles dependencies (e.g., if word A is selected, its related word B might need to be included).
- It can optionally include "related words" (words not explicitly selected by the user but related to selected ones) to increase question variety.

### OCR (Image Recognition)
- `src/lib/ocr.ts` communicates with a PaddleOCR microservice.
- It sends base64 encoded images and receives recognized words, bounding boxes, and confidence scores.
- It specifically handles "highlighted" words in images.
- The development environment script `scripts/dev.mjs` can automatically start this PaddleOCR service.

## Directory Structure
- `src/app`: Next.js App Router pages and API routes.
- `src/actions`: Server Actions for business logic (auth, AI questions, image recognition).
- `src/components`: React UI components, including Shadcn UI primitives in `ui/`.
- `src/lib`: Core libraries (AI, OCR, DB, Dictionary, Utilities).
- `src/types`: TypeScript type definitions.
- `prisma`: Prisma schema and migrations.
- `scripts`: Utility and maintenance scripts.
