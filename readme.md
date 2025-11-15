# MIJOB - Mission Management System

Complete backend implementation for the MIJOB platform mission management system.

## 📁 Project Structure

```
mijob-backend/
├── models/
│   ├── Mission.js          # Mission schema with all fields and validations
│   └── User.js             # (You already have this)
├── controllers/
│   └── missionController.js # All mission business logic
├── routes/
│   ├── missions.js         # Mission routes
│   └── auth.js             # (Your existing auth routes)
├── middleware/
│   ├── auth.js             # Authentication & authorization middleware
│   ├── validation.js       # Mission validation middleware
│   └── errorHandler.js     # (Your existing error handler)
├── utils/
│   ├── AppError.js         # (You already have this)
│   ├── catchAsync.js       # (You already have this)
│   └── email.js            # Email utility functions
├── data/
│   ├── cities.js           # Moroccan cities list
│   └── services.js         # Service types list
├── config/
│   └── database.js         # (Your existing DB config)
├── .env.example            # Environment variables template
├── server.js               # (Your existing server file)
└── package.json
```

## 🚀 Features Implemented

### Mission Schema
- ✅ Complete mission data model
- ✅ entreprise/recruiter reference
- ✅ Mission details (title, description, dates, times)
- ✅ Location handling (onsite with address/coordinates or remote)
- ✅ Payment information (hourly/daily/fixed)
- ✅ Featured listing support
- ✅ Token cost tracking
- ✅ Application management
- ✅ Status tracking (draft, active, completed, cancelled)
- ✅ Rating system
- ✅ View counter
- ✅ Auto-expiration

### API Endpoints

#### Public Routes
```
GET    /api/v1/missions/public              # Get all public missions
GET    /api/v1/missions/public/:id          # Get single mission
GET    /api/v1/missions/search               # Search missions
GET    /api/v1/missions/featured             # Get featured missions
```

#### Protected Routes (Authentication Required)

**Mission CRUD**
```
GET    /api/v1/missions                      # Get all missions (filtered)
POST   /api/v1/missions                      # Create mission (entreprise/particulier)
GET    /api/v1/missions/:id                  # Get mission details
PATCH  /api/v1/missions/:id                  # Update mission (Owner only)
DELETE /api/v1/missions/:id                  # Delete mission (Owner only)
```

**entreprise Specific**
```
GET    /api/v1/missions/entreprise/my-missions  # Get my missions
GET    /api/v1/missions/entreprise/statistics   # Get statistics
GET    /api/v1/missions/entreprise/export       # Export to CSV
```

**Mission Management**
```
PATCH  /api/v1/missions/:id/status           # Update status
PATCH  /api/v1/missions/:id/complete         # Mark as completed
PATCH  /api/v1/missions/:id/cancel           # Cancel mission
```

**Applications**
```
POST   /api/v1/missions/:id/apply            # Apply to mission (Partimer)
GET    /api/v1/missions/:id/applications     # Get applications (Owner)
PATCH  /api/v1/missions/:id/applications/:applicationId  # Accept/Reject
PATCH  /api/v1/missions/:id/select-partimer  # Select partimer
```

**Rating & Analytics**
```
POST   /api/v1/missions/:id/rate             # Rate mission/partimer
POST   /api/v1/missions/:id/view             # Increment view count
```

## 🔧 Installation

### 1. Install Dependencies
```bash
npm install mongoose nodemailer
```

### 2. Environment Setup
Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Update the following variables:
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Your JWT secret key
- `CLIENT_URL`: Your frontend URL
- Email configuration (use Ethereal for testing)

### 3. File Integration

Place the files in your project structure:

```bash
# Models
cp models/Mission.js your-project/models/

# Controllers
cp controllers/missionController.js your-project/controllers/

# Routes
cp routes/missions.js your-project/routes/

# Middleware
cp middleware/auth.js your-project/middleware/
cp middleware/validation.js your-project/middleware/

# Utils
cp utils/email.js your-project/utils/

# Data
mkdir your-project/data
cp data/cities.js your-project/data/
cp data/services.js your-project/data/
```

### 4. Update Server.js

Your `server.js` already has the mission routes configured:
```javascript
app.use('/api/v1/missions', require('./routes/missions'));
```

## 📊 Database Indexes

The Mission schema includes optimized indexes for:
- entreprise + Status lookups
- City + Service Type + Status searches
- Featured listings sorting
- Date-based queries
- Expiration checks

## 🔐 Authentication & Authorization

### Middleware Functions

**protect**: Verifies JWT token and authenticates user
```javascript
const { protect } = require('./middleware/auth');
router.get('/protected-route', protect, controller);
```

**restrictTo**: Restricts access to specific user roles
```javascript
const { restrictTo } = require('./middleware/auth');
router.post('/create', protect, restrictTo('entreprise', 'particulier'), controller);
```

**requireActiveSubscription**: Checks for active subscription
**checkTokenQuota**: Verifies sufficient token balance
**requireVerifiedEmail**: Ensures email is verified
**requireCompleteProfile**: Checks profile completion

## 💰 Token System

### Token Costs
- **Base Publication**: 1 token
- **Featured Listing**: +2 tokens
- Total calculated automatically

### Subscription Limits
- **Basic**: 3 missions/month
- **Premium**: 8 missions/month
- **Accompagnement**: Unlimited (custom)

## 📧 Email Notifications

Automated emails for:
- ✅ Mission application received (to entreprise)
- ✅ Application accepted/rejected (to partimer)
- ✅ Mission cancelled (to all applicants)
- ✅ Rating request (24h after completion)
- ✅ Rating received (to partimer)

## 🎯 Key Features

### Token Management
- Automatic token deduction on mission creation
- Balance checking before publication
- Featured listing upgrade option

### Application System
- Partimers can apply with optional message
- Companies receive notifications
- Accept/reject functionality
- Selected partimer tracking

### Rating System (After Mission)
- 1-5 star rating
- Optional comment
- Updates partimer's overall rating
- Custom feedback messages in French

### Mission Lifecycle
```
draft → active → completed (or cancelled)
```

### Smart Validation
- Date/time validation
- Address requirements for onsite missions
- Payment amount validation
- Subscription limit checking
- Token balance verification

## 📝 Example Usage

### Create a Mission
```javascript
POST /api/v1/missions
Headers: { Authorization: "Bearer <token>" }
Body: {
  "title": "Serveur pour événement",
  "city": "Casablanca",
  "serviceType": "Serveur / Serveuse",
  "description": "Recherche serveur expérimenté pour un événement d'entreprise...",
  "startDate": "2025-11-15",
  "endDate": "2025-11-15",
  "startTime": "18:00",
  "endTime": "23:00",
  "paymentType": "hourly",
  "paymentAmount": 50,
  "workType": "onsite",
  "addressInputType": "manual",
  "address": "123 Avenue Hassan II, Casablanca",
  "featuredListing": false
}
```

### Apply to Mission
```javascript
POST /api/v1/missions/:id/apply
Headers: { Authorization: "Bearer <partimer-token>" }
Body: {
  "message": "Bonjour, je suis très intéressé par cette mission..."
}
```

### Rate Mission
```javascript
POST /api/v1/missions/:id/rate
Headers: { Authorization: "Bearer <entreprise-token>" }
Body: {
  "score": 5,
  "comment": "Excellent travail, très professionnel !"
}
```

## 🔍 Query Examples

### Search Missions
```javascript
GET /api/v1/missions/public?city=Casablanca&serviceType=Serveur&page=1&limit=10
```

### Get entreprise Missions
```javascript
GET /api/v1/missions/entreprise/my-missions?status=active
```

### Filter by Payment Range
```javascript
GET /api/v1/missions?minPayment=50&maxPayment=200&paymentType=hourly
```

## 🛡️ Security Features

- JWT authentication
- Role-based access control
- Input sanitization (XSS prevention)
- Token quota checking
- Subscription validation
- Owner verification for updates/deletes

## 📦 Dependencies Required

```json
{
  "mongoose": "^8.0.0",
  "nodemailer": "^6.9.0",
  "express": "^4.18.0",
  "jsonwebtoken": "^9.0.0",
  "bcryptjs": "^2.4.3",
  "dotenv": "^16.0.0",
  "cors": "^2.8.5",
  "helmet": "^7.0.0",
  "express-rate-limit": "^7.0.0",
  "compression": "^1.7.4"
}
```

## 🧪 Testing Emails

For development, use [Ethereal Email](https://ethereal.email/):
1. Create a free account
2. Get SMTP credentials
3. Add to `.env` file
4. Preview emails in browser

## 🚨 Error Handling

All controllers use `catchAsync` wrapper and `AppError` class for consistent error handling:

```javascript
// Validation Error
throw new AppError(400, 'Invalid input data');

// Authorization Error
throw new AppError(403, 'Insufficient permissions');

// Not Found Error
throw new AppError(404, 'Mission not found');
```

## 📱 Frontend Integration

The backend is designed to work with the provided frontend component. Key features:
- Token cost calculation matches frontend display
- Address input types (manual/map) supported
- Featured listing toggle
- Real-time validation

## 🔄 Auto-Expiration

Missions automatically expire after 30 days. Use a cron job or scheduler to mark expired missions:

```javascript
// Example cron job (using node-cron)
cron.schedule('0 0 * * *', async () => {
  await Mission.updateMany(
    { status: 'active', expiresAt: { $lt: new Date() } },
    { status: 'expired' }
  );
});
```

## 📈 Future Enhancements

Potential additions:
- Mission templates
- Bulk operations
- Advanced analytics
- Notification preferences
- Multi-language support
- Payment integration
- Contract generation

## 🆘 Support

For issues or questions:
1. Check the error messages (they're descriptive)
2. Verify environment variables
3. Check database connection
4. Review authentication tokens
5. Validate request payload

## 📄 License

This code is part of the MIJOB platform.

---

**Version**: 1.0.0  
**Last Updated**: October 2025  
**Maintainer**: MIJOB Development Team