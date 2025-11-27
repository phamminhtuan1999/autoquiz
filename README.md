# AutoQuiz - Document-to-Quiz SaaS Platform

A Next.js 14 SaaS application that converts PDF documents into interactive quizzes using Google Gemini AI, with credit-based billing powered by Stripe.

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS
- **Backend/Auth/DB**: Supabase (using @supabase/ssr for cookie handling)
- **Payments**: Stripe (Checkout Sessions + Webhooks)
- **AI**: Google Gemini API (for quiz generation)
- **PDF Parsing**: pdfjs-dist (Client-side extraction)

## Features

- 🔐 **Authentication**: Google/Email login via Supabase Auth
- 💳 **Credit System**: New users get 3 free credits, 1 credit per quiz generation
- 💰 **Payments**: Buy 10 credits via Stripe Checkout
- 📄 **PDF Processing**: Client-side PDF text extraction
- 🤖 **AI Quiz Generation**: Google Gemini creates quiz questions from document content
- 🔒 **Row Level Security**: Users can only access their own data

## Getting Started

### Prerequisites

- Node.js 20.16.0 or higher
- npm or yarn
- Supabase account
- Stripe account
- Google Gemini API key

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd autoquiz
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` and add your credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-pro

# App URL (optional)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)

2. Run the SQL schema in your Supabase SQL Editor:
   - Open `supabase/schema.sql`
   - Copy and paste the entire contents into the Supabase SQL Editor
   - Execute the script

This will create:

- `profiles` table with credit tracking
- `quizzes` table for storing generated quizzes
- Auto-create profile trigger on user signup
- RPC functions: `add_credits` and `deduct_credit`
- Row Level Security policies

3. Configure Auth providers:
   - Go to Authentication > Providers in Supabase
   - Enable Email and/or Google OAuth
   - For Google OAuth, add your redirect URL: `http://localhost:3000/api/auth/callback`

### Stripe Setup

1. Create a Stripe account at [stripe.com](https://stripe.com)

2. Get your API keys from the Stripe Dashboard:

   - Secret Key: Found in Developers > API keys
   - Webhook Secret: Create a webhook endpoint pointing to `https://your-domain.com/api/webhooks/stripe`
   - Select event: `checkout.session.completed`

3. For local development, use Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

This will give you a webhook secret starting with `whsec_`

### Google Gemini Setup

1. Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

2. Add it to your `.env` file

### Running the Application

1. Start the development server:

```bash
npm run dev
```

2. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   └── callback/route.ts    # Supabase auth callback
│   │   ├── checkout/route.ts         # Stripe checkout session
│   │   └── webhooks/
│   │       └── stripe/route.ts      # Stripe webhook handler
│   ├── dashboard/
│   │   ├── page.tsx                  # Dashboard with credits & quiz list
│   │   └── quizzes/
│   │       └── [quizId]/page.tsx     # Individual quiz view
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Home page with PDF uploader
├── actions/
│   └── generate-quiz.ts              # Server action for quiz generation
├── components/
│   ├── buy-credits-button.tsx        # Stripe checkout button
│   └── pdf/
│       └── uploader.tsx              # PDF upload & quiz generation UI
├── lib/
│   ├── gemini.ts                     # Google Gemini API client
│   ├── stripe.ts                     # Stripe client
│   └── supabase/
│       ├── client.ts                 # Browser Supabase client
│       ├── server.ts                 # Server Supabase client
│       └── server-admin.ts           # Service role client (for webhooks)
├── middleware.ts                     # Auth middleware
└── utils/
    └── pdf.ts                        # PDF text extraction utility
```

## Key Features Implementation

### Credit System

- New users automatically get 3 credits via database trigger
- Quiz generation checks credits before processing
- Credits are deducted atomically using RPC function
- Stripe webhook adds 10 credits on successful payment

### Quiz Generation Flow

1. User uploads PDF (client-side extraction)
2. Text is sent to server action `generateQuiz`
3. Server checks user credits
4. Calls Google Gemini API
5. Deducts 1 credit
6. Saves quiz to Supabase
7. Returns questions to client

### Stripe Integration

- Checkout session created with user metadata
- Webhook verifies signature using raw request body
- Credits added via service role client (bypasses RLS)

## Building for Production

```bash
npm run build
npm start
```

## Environment Variables Reference

| Variable                        | Description                                   | Required |
| ------------------------------- | --------------------------------------------- | -------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                          | Yes      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key                        | Yes      |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase service role key (for webhooks)      | Yes      |
| `STRIPE_SECRET_KEY`             | Stripe secret key                             | Yes      |
| `STRIPE_WEBHOOK_SECRET`         | Stripe webhook signing secret                 | Yes      |
| `GEMINI_API_KEY`                | Google Gemini API key                         | Yes      |
| `GEMINI_MODEL`                  | Gemini model to use (default: gemini-1.5-pro) | No       |
| `NEXT_PUBLIC_APP_URL`           | Your app URL (for redirects)                  | No       |

## License

MIT
