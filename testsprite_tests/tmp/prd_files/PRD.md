# Product Requirements Document (PRD): ChaiTapri

## 1. Executive Summary
**ChaiTapri** is a "Khata" (Ledger) and Point-of-Sale (POS) application tailored for small tea and coffee vendors in India. It digitizes the traditional credit system, allowing vendors to track daily consumption, manage customer balances, and accept digital payments. It also includes an affiliate system to incentivize user growth.

## 2. Goals & Objectives
*   **Digitize Operations:** Replace paper-based ledgers with a mobile-first digital system.
*   **Speed:** Enable "One-Tap" logging of items (Chai/Coffee) to minimize friction during peak hours.
*   **Transparency:** Provide customers with real-time access to their dues via public links.
*   **Growth:** Leverage an affiliate/referral system to onboard new vendors.

## 3. User Personas
1.  **Vendor (Shop Owner):** Using the app to manage their shop, track customer dues, and mark payments. Requires a fast, mobile-friendly interface.
2.  **Customer:** The end-consumer drinking chai. Wants to see their pending balance and verify payments history.
3.  **Affiliate:** Helps onboard new vendors and earns a commission on subscriptions/usage.

## 4. Functional Requirements

### 4.1. Authentication & Onboarding
*   **Sign Up/Login:**
    *   **Google Sign-In:** Primary method using ID Token verification.
    *   **Guest Mode:** Allows exploring the app without credentials (data stored temporarily or in a "Guest" store).
    *   **Email/Password:** Fallback legacy support.
*   **Store Creation:**
    *   Automatically creates a `Store` entity upon user registration.
    *   Default settings (Currency: ₹, Shop Name: [User]'s Shop).

### 4.2. Point of Sale (POS) / Dashboard
*   **Quick Actions:**
    *   Large, distinct buttons for "Add Chai" and "Add Coffee".
    *   Buttons must support rapid tapping (debounce handling required).
    *   Haptic feedback (optional) or visual confirmation on tap.
*   **Customer Selection:**
    *   Dropdown/Search to select a registered customer.
    *   "Walk-in" mode for non-registered sales.
*   **Transaction Logging:**
    *   Clicking a product creates a `Log` entry (Debit) with:
        *   `quantity`, `drink_type`, `price_at_time`, `timestamp`.

### 4.3. Ledger (Khata) Management
*   **Balance Calculation:**
    *   *Balance = Sum(Logs) - Sum(Payments)*
    *   Must update in real-time as items are added.
*   **Detailed History:**
    *   View all transaction logs and payment history for a specific customer.
    *   Ability to delete incorrect logs (Owner only).
*   **Payments:**
    *   **Mark as Paid:** Record a full or partial payment.
    *   **Receipts:** Upload screenshot/image proof for payments.
    *   **Status Indicators:** `Pending`, `Due` (Red), `Paid` (Green).

### 4.4. Public Features
*   **Public Ledger Link:**
    *   URL format: `/ledger/:customer_slug`
    *   Allows unauthenticated access for customers to view their own history and dues.
*   **Customer Payment Confirmation:**
    *   Customers can upload a payment receipt via the public link.
    *   Notifies the vendor (via SSE/Notification service).

### 4.5. Affiliate & Referral System
*   **Referral Logic:**
    *   Unique referral code generation for every user.
    *   Track signups via `?ref=CODE`.
*   **Commission Tracking:**
    *   Dashboard showing `Total Earnings`, `Pending`, and `Paid` commissions.
    *   Prevent self-referrals.
*   **Payouts:**
    *   Vendors can request payouts via UPI or Bank Transfer.
    *   Minimum payout threshold (e.g., ₹500).

### 4.6. Store Settings
*   **Pricing:** Configurable price per unit (Chai/Coffee).
*   **Profile:** Update Shop Name, UPI ID (for receiving payments).
*   **Notifications:** Toggle for web/push notifications.

## 5. Non-Functional Requirements
*   **Mobile-First Design:** UI must be optimized for touch targets (44px+) and usable with one hand.
*   **Performance:** Dashboard load time < 2 seconds. "Add Item" latency < 200ms.
*   **Security:**
    *   Token-based authentication (JWT).
    *   Strict Rate Limiting on Admin/Auth routes.
    *   Input validation on all forms.
*   **Data Integrity:** Prices are stored *at the time of transaction* (snapshot) in the logs, not referenced dynamically, to preserve historical accuracy.

## 6. Data Model (Schema)
*   **Users:** Identity management (`google_id`, `email`, `picture`).
*   **Stores:** Links user to shop data (`currency`, `upi_id`).
*   **Customers:** Profiles linked to a specific Store.
*   **Logs (Debits):** The core transaction record (`customer_id`, `quantity`, `price`).
*   **Payments (Credits):** Settlement records (`amount`, `receipt_url`).
*   **Affiliates:** Tracking earnings and payout requests.

## 7. Future Scope
*   **Inventory Management:** Track milk/sugar usage based on consumption logs.
*   **Subscriptions:** Monthly prepaid plans for regular customers.
*   **WhatsApp Integration:** Send automatic "Due Amount" reminders to customers via WhatsApp.
