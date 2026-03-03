# Quick Start Guide - Voting Management System

## 🚀 Get Started in 5 Minutes

### Prerequisites
✅ Node.js installed  
✅ MongoDB installed and running  
✅ Server running on port 6008  

---

## Step 1: Start the Server (if not running)

```bash
cd e:\Downloads\miniprojectniceone\project
node server.js
```

**Expected Output**:
```
Server running on http://localhost:6008
Connected to MongoDB
```

---

## Step 2: Access the Application

Open your browser and navigate to:
```
http://localhost:6008/login.html
```

---

## Step 3: Login as Super Admin

**Credentials**:
- Username: `superadmin`
- Password: `admin123`

You'll be redirected to: `http://localhost:6008/super-admin.html`

---

## Step 4: Create and Start an Election

1. **Create Election**:
   - Click "New Class Representative Election"
   - Select start and end dates
   - Click "Create Election"

2. **Start Election**:
   - Click "Start Election" button
   - Status changes to "Ongoing" (green)

---

## Step 5: Add Candidates (as Tutor Admin)

1. **Logout** from Super Admin
2. **Login as Tutor Admin**:
   - Username: `tutoradmin`
   - Password: `admin123`

3. **Navigate to Admin Dashboard**:
   - Type in browser: `http://localhost:6008/admin.html`
   - (Auto-redirect to voting is expected, manually go back to admin.html)

4. **Add Candidates**:
   - Select student from dropdown
   - Select position (president, vice_president, etc.)
   - Click "Add Candidate"
   - Add at least 3 candidates

---

## Step 6: Register Students (if none exist)

If you don't have students in the dropdown:

1. Navigate to: `http://localhost:6008/login.html`
2. Click "Register as Student" (or navigate to registration page)
3. Fill in:
   - Name
   - Admission Number (e.g., `adm123`)
   - Class Name
   - Upload photo
4. Click "Register"
5. Repeat for at least 3 students

---

## Step 7: Test Voting Flow

### Option A: Face Verification Success

1. Navigate to: `http://localhost:6008/voting.html`

2. **Step 1**: Enter admission number (e.g., `adm123`)

3. **Step 2**: Upload the SAME photo used during registration
   - Should show: "Face verified successfully!"
   - Auto-advance to Step 3

4. **Step 3**: Select a candidate

5. Click "Submit Vote"
   - Should show: "Vote cast successfully!"

### Option B: Manual Approval Path

1. **Step 1**: Enter admission number (e.g., `adm456`)

2. **Step 2**: Upload WRONG photo (different student's photo)
   - Try 3 times → All fail
   - Should show: "Maximum attempts reached. Request sent for manual verification."

3. **Login as Super Admin**:
   - Navigate to: `http://localhost:6008/super-admin.html`
   - Go to "Verification Requests" tab
   - Click "Approve" for the pending request

4. **Return to Voting Page**:
   - Enter same admission number (`adm456`)
   - Should show: "Your verification is already approved!"
   - Skip directly to Step 3 (candidate selection)

5. **Select candidate and vote**

---

## Step 8: End Election and View Results

1. **Login as Super Admin**

2. **End Election**:
   - Click "End Election" button
   - Watch console for aggregation logs

**Console Logs to Verify**:
```
[ELECTION_END] Before aggregation: 3 candidates
[ELECTION_END] Vote aggregation: { candidate_id: ..., total_votes: 2 }
[ELECTION_END] Updated candidate vote counts
[ELECTION_END] After aggregation: 3 candidates
[ELECTION_END] Top 2 marked as elected
[ELECTION_END] Created 2 ElectedRepresentative records
```

3. **View Results**:
   - Login as Tutor Admin
   - Navigate to: `http://localhost:6008/admin.html`
   - See results table with:
     - Rank (1, 2, 3...)
     - Candidate names
     - Vote counts
     - "Elected" badge on top 2

4. **View Elected Representatives**:
   - Login as Staff Advisor (username: `staffadvisor`, password: `admin123`)
   - Navigate to: `http://localhost:6008/staff-advisor.html`
   - See elected representatives table

---

## 🎯 Verification Checklist

After completing the flow, verify:

✅ Students can vote with face verification  
✅ Manual approval bypasses face check  
✅ Votes are counted correctly  
✅ Election ends without errors  
✅ Top 2 candidates marked elected  
✅ Results display with correct vote counts  
✅ Elected representatives created  
✅ Candidates preserved in database (not deleted)  
✅ No duplicate votes allowed  

---

## 🐛 Common Issues

### Issue: "No candidates available"
**Solution**: 
- Add candidates via admin dashboard
- Verify election status is "ongoing"
- Check browser console for errors

### Issue: Face verification always fails
**Solution**:
- Use the SAME photo for registration and voting
- Check console: `[FACE_VERIFY] Distance: X` (should be < 0.6)
- Clear browser cache

### Issue: Can't add candidates
**Solution**:
- Ensure students are registered first
- Verify election exists and has correct status
- Check server console for errors

### Issue: "Student not found"
**Solution**:
- Verify admission number is correct (case-insensitive)
- Check student exists in database
- Ensure student is verified

---

## 📊 Database Quick Check

Open MongoDB shell or Compass:

```javascript
// Check students
db.students.find()

// Check candidates
db.candidates.find({ election_id: ObjectId("...") })

// Check votes
db.votes.find({ election_id: ObjectId("...") })

// Check elected representatives
db.electedrepresentatives.find()

// Check verification requests
db.verificationrequests.find({ status: "pending" })
```

---

## 🔐 Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Super Admin | `superadmin` | `admin123` |
| Tutor Admin | `tutoradmin` | `admin123` |
| Staff Advisor | `staffadvisor` | `admin123` |

---

## 📱 Quick Access URLs

- **Login**: http://localhost:6008/login.html
- **Super Admin**: http://localhost:6008/super-admin.html
- **Tutor Admin**: http://localhost:6008/admin.html
- **Staff Advisor**: http://localhost:6008/staff-advisor.html
- **Voting**: http://localhost:6008/voting.html

---

## 🎨 User Flow Diagram

```
┌─────────────┐
│ Super Admin │ → Create Election → Start Election
└─────────────┘

┌─────────────┐
│ Tutor Admin │ → Add Candidates (min 3)
└─────────────┘

┌──────────┐
│ Students │ → Vote (face verification OR manual approval)
└──────────┘

┌─────────────┐
│ Super Admin │ → End Election → Vote Aggregation
└─────────────┘

┌─────────────┐
│   Results   │ → View in Admin/Staff Advisor dashboards
└─────────────┘
```

---

## 🧪 Quick Test Script

Fastest way to test the complete flow:

```javascript
// 1. Super Admin: Create election
POST http://localhost:6008/api/admin/login
{"username":"superadmin","password":"admin123"}
// Get token

POST http://localhost:6008/api/election/create
{"type":"class_level","start_date":"2024-01-01","end_date":"2024-12-31"}
// Get election_id

POST http://localhost:6008/api/election/start/{election_id}

// 2. Tutor Admin: Add candidates
POST http://localhost:6008/api/admin/login
{"username":"tutoradmin","password":"admin123"}
// Get token

POST http://localhost:6008/api/candidate/add
{"student_id":"...","election_id":"...","position":"president"}
// Repeat for 3 candidates

// 3. Students: Vote
POST http://localhost:6008/api/vote
{"admission_no":"adm123","candidate_id":"...","election_id":"..."}
// Repeat for multiple students

// 4. Super Admin: End election
POST http://localhost:6008/api/election/end/{election_id}

// 5. View results
GET http://localhost:6008/api/candidates/{election_id}
```

---

## 📚 Further Documentation

- **[BUG_FIXES_SUMMARY.md](BUG_FIXES_SUMMARY.md)** - What was fixed and how
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Comprehensive testing instructions
- **[API_REFERENCE.md](API_REFERENCE.md)** - All API endpoints
- **[FACE_RECOGNITION_STATUS.md](FACE_RECOGNITION_STATUS.md)** - Face verification details

---

## 🎉 You're Ready!

The system is fully functional and ready for use. Start with registering students, then follow the flow above to test the complete election process.

**Happy Voting! 🗳️**
