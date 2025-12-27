# MRAID Capture Tool - Monetization Plan

## Overview

Exploring two monetization routes for the MRAID Capture Tool:
1. **Ad-based model** - Video ad modal before each download
2. **Freemium model** - Interactive mode as a paid feature

---

## Route 1: Ad-Based Model

### Concept
Every render/export triggers a modal with a video ad. User watches ad, then can download.

### User Flow
```
User clicks Download/Export
        ↓
   Modal appears
   "Watch a short ad to download"
        ↓
   Video ad plays (15-30s)
        ↓
   Ad completes → Download button enabled
        ↓
   User clicks → File downloads
```

### Implementation

#### New Files
- `src/components/ad-modal.tsx` - Modal with video player
- `src/hooks/use-download-manager.ts` - Manages modal + pending downloads
- `src/lib/ads/provider.ts` - Ad provider integration

#### Files to Modify
- `src/app/page.tsx` - Wrap download calls with modal trigger

#### Intercept Points (3 locations in page.tsx)
| Download Type | Location | Current Call |
|--------------|----------|--------------|
| Recording | Line 99-102 | `downloadVideo()` |
| Screenshot | Line 219 | `downloadScreenshot()` |
| Batch Zip | Line 277 | `downloadBlob()` |

#### Ad Provider Options
1. **Google AdSense Video** - Most common, good fill rates
2. **Google Ad Manager** - More control, requires account
3. **Self-hosted** - Your own video ads (sponsors, etc.)

### Pros
- ✅ No paywall - accessible to all users
- ✅ Revenue per download (CPM model)
- ✅ Simple to implement
- ✅ Works for casual/one-time users

### Cons
- ❌ Annoying UX - friction on every download
- ❌ Ad blockers defeat it
- ❌ Lower revenue per user than subscriptions
- ❌ Need significant traffic volume for meaningful revenue

### Revenue Estimate
- Video ad CPM: ~$5-15
- 1000 downloads/month = $5-15/month
- Need 100k+ downloads for meaningful revenue

---

## Route 2: Freemium Model

### Concept
Core features free, Interactive Mode requires payment.

### Feature Split

| Feature | Free | Paid |
|---------|------|------|
| Screenshot | ✅ | ✅ |
| Video Recording (WebM) | ✅ | ✅ |
| MP4 Conversion | ✅ | ✅ |
| Batch Screenshots | ✅ | ✅ |
| Reload & Record | ✅ | ✅ |
| **Interactive Mode** | ❌ | ✅ |
| Priority support | ❌ | ✅ |

### User Flow
```
User clicks "Interactive" button
        ↓
   [If not paid]
   Modal: "Interactive Mode is a Pro feature"
   "Record your interactions and replay them"
   [$X one-time / $X/mo]
        ↓
   Payment via Stripe/Gumroad
        ↓
   License key stored in localStorage
        ↓
   Feature unlocked
```

### Implementation

#### New Files
- `src/components/paywall-modal.tsx` - Upgrade prompt
- `src/hooks/use-license.ts` - License validation
- `src/lib/licensing/validator.ts` - Check license key
- `src/lib/licensing/storage.ts` - Persist license

#### Files to Modify
- `src/app/page.tsx` - Gate interactive mode behind license check
- `src/components/interactive-controls.tsx` - Show lock icon if unpaid

#### Payment Integration Options
1. **Gumroad** - Simplest, handles everything, 10% fee
2. **Stripe** - More control, 2.9% + $0.30
3. **LemonSqueezy** - Good for SaaS, handles tax

#### License Validation Approaches
1. **Simple key in localStorage** - Easy to bypass but simple
2. **Server validation** - More secure, needs backend
3. **License file** - Download and import

### Pros
- ✅ Clean UX for free users
- ✅ Higher revenue per paying user
- ✅ Sustainable recurring revenue (if subscription)
- ✅ Users who pay are invested

### Cons
- ❌ Limits feature adoption
- ❌ Harder to convert free → paid
- ❌ Need compelling paid feature
- ❌ Payment integration complexity

### Pricing Options
| Model | Price | Notes |
|-------|-------|-------|
| One-time | $9.99 - $19.99 | Simple, no recurring |
| Monthly | $4.99/mo | Recurring, higher LTV |
| Yearly | $29.99/yr | Discount for commitment |

---

## Comparison

| Aspect | Ad-Based | Freemium |
|--------|----------|----------|
| User friction | Every download | Only for pro features |
| Revenue model | CPM (per impression) | Per license/subscription |
| Implementation | Easier | Moderate |
| Ad blocker risk | High | None |
| Scale needed | High traffic | Fewer paying users |
| UX quality | Worse | Better |

---

## Chosen Approach: Hybrid Model

**Decision**: Hybrid with Google AdSense
- Free users see video ad before download
- Pro users get ad-free downloads + Interactive Mode

---

## Implementation Plan

### Phase 1: Ad Modal (Free Users)

#### Step 1: Create Ad Modal Component
**File**: `src/components/ad-modal.tsx`

```
- Modal overlay with video container
- "Watch ad to download" messaging
- Google AdSense video ad integration
- Download button (disabled until ad completes)
- Skip option for Pro users
```

#### Step 2: Create Download Manager Hook
**File**: `src/hooks/use-download-manager.ts`

```
- Queue pending downloads
- Check license status
- Show ad modal OR download directly
- Handle ad completion callback
```

#### Step 3: Integrate Google AdSense
**File**: `src/lib/ads/adsense.ts`

```
- Load AdSense script
- Initialize video ad unit
- Handle ad events (start, complete, error)
- Fallback if ad fails to load
```

#### Step 4: Update Page
**File**: `src/app/page.tsx`

```
- Replace direct download calls with download manager
- Add AdModal to component tree
```

### Phase 2: License/Pro Tier

#### Step 5: Create License Hook
**File**: `src/hooks/use-license.ts`

```
- Check localStorage for license key
- Validate key format
- Provide isPro boolean
```

#### Step 6: Create Paywall Modal
**File**: `src/components/paywall-modal.tsx`

```
- "Upgrade to Pro" messaging
- Feature list (ad-free, Interactive Mode)
- Link to Gumroad/payment page
- License key input field
```

#### Step 7: Gate Interactive Mode
**File**: `src/components/interactive-controls.tsx`

```
- Check isPro before allowing Interactive Mode
- Show lock icon + "Pro" badge if not licensed
- Open paywall modal on click
```

### Files Summary

| New Files | Purpose |
|-----------|---------|
| `src/components/ad-modal.tsx` | Video ad modal |
| `src/components/paywall-modal.tsx` | Upgrade prompt |
| `src/hooks/use-download-manager.ts` | Download + ad logic |
| `src/hooks/use-license.ts` | License validation |
| `src/lib/ads/adsense.ts` | AdSense integration |

| Modified Files | Changes |
|----------------|---------|
| `src/app/page.tsx` | Use download manager, add modals |
| `src/components/interactive-controls.tsx` | Gate behind license |

### User Experience

#### Free User - Download Flow
```
Click Download → Ad Modal appears → Watch 15-30s ad → Download enabled → Click Download
```

#### Free User - Interactive Mode
```
Click Interactive → Paywall Modal → "Upgrade to Pro" → Enter license key → Feature unlocked
```

#### Pro User - Download Flow
```
Click Download → File downloads immediately (no ad)
```

#### Pro User - Interactive Mode
```
Click Interactive → Works normally
```

### Google AdSense Setup Notes

1. Need AdSense account approved
2. Create video ad unit in AdSense dashboard
3. Get Publisher ID and Ad Unit ID
4. Add `<script>` to load AdSense library
5. May need content policy compliance review
