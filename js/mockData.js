// Mock Data for Employee Dashboard

const MockData = {
    // ========== USER INFORMATION ==========
    user: {
        id: 1,
        name: 'Alex Mercer',
        email: 'alex.mercer@company.com',
        role: 'Senior Developer',
        department: 'Engineering',
        joinDate: '2020-06-01',
        avatar: '../assets/icons/avatar-placeholder.svg',
        phone: '+91 98765 43210',
        address: '#42, Brigade Road, Bangalore, Karnataka, 560001'
    },

    // ========== EMPLOYEE PROFILE DATA ==========
    employeeProfile: {
        // Step 1: Personal Information
        personalInfo: {
            firstName: 'Alex',
            middleName: 'James',
            lastName: 'Mercer',
            employeeId: 'EMP001234',
            dateOfBirth: '1990-05-15',
            gender: 'Male',
            maritalStatus: 'Married',
            bloodGroup: 'A-',
            panNumber: 'ABCDE1234F',
            aadhaarNumber: '1234-5678-9012',
            nationality: 'Indian',
            religion: 'Hindu',
            linkedinProfile: 'https://linkedin.com/in/alexmercer',
            spouseName: 'Sarah Mercer',
            physicallyChallenged: false,
            disabilityType: '',
            disabilityPercent: '',
            certificateNumber: ''
        },

        // Step 2: Job Details
        jobDetails: {
            department: 'Engineering',
            subDepartment: 'Frontend Development',
            designation: 'Senior Developer',
            employeeGrade: 'E3',
            employmentType: 'Permanent',
            joiningDate: '2020-06-01',
            probationEndDate: '2020-12-01',
            reportingManager: 'John Smith',
            hrBusinessPartner: 'Emily Davis',
            workLocation: 'Bangalore',
            basicSalary: 75000,
            shift: 'Day',
            costCentre: 'CC-ENG-01',
            bankDetails: {
                bankName: 'HDFC Bank',
                accountNumber: 'XXXXXXXX1234',
                ifscCode: 'HDFC0001234'
            }
        },

        // Step 3: Contact & Address
        contactInfo: {
            personalEmail: 'alex.mercer@gmail.com',
            workEmail: 'alex.mercer@company.com',
            mobileNumber: '+91 98765 43210',
            alternatePhone: '+91 98765 43211',
            currentAddress: {
                street: '#42, Brigade Road',
                city: 'Bangalore',
                state: 'Karnataka',
                pinCode: '560001',
                country: 'India'
            },
            permanentAddress: {
                street: '#42, Brigade Road',
                city: 'Bangalore',
                state: 'Karnataka',
                pinCode: '560001',
                country: 'India'
            },
            emergencyContact: {
                name: 'Sarah Mercer',
                relationship: 'Spouse',
                phone: '+91 98765 43212'
            }
        },

        // Step 4: Education & Family
        education: [
            {
                id: 1,
                degree: 'B.Tech in Computer Science',
                institute: 'Indian Institute of Technology',
                year: '2012',
                percentage: '85%'
            },
            {
                id: 2,
                degree: 'Higher Secondary Education',
                institute: 'Delhi Public School',
                year: '2008',
                percentage: '88%'
            }
        ],

        familyDetails: [
            {
                id: 1,
                name: 'Sarah Mercer',
                relationship: 'Spouse',
                occupation: 'Software Engineer',
                contact: '+91 98765 43212'
            },
            {
                id: 2,
                name: 'Robert Mercer',
                relationship: 'Father',
                occupation: 'Retired',
                contact: '+91 98765 43213'
            },
            {
                id: 3,
                name: 'Maria Mercer',
                relationship: 'Mother',
                occupation: 'Homemaker',
                contact: '+91 98765 43214'
            }
        ],

        workExperience: [
            {
                id: 1,
                company: 'Tech Solutions Inc.',
                designation: 'Software Developer',
                years: '2 years',
                location: 'Bangalore'
            },
            {
                id: 2,
                company: 'Digital Innovations Ltd.',
                designation: 'Senior Frontend Developer',
                years: '3 years',
                location: 'Mumbai'
            }
        ],

        // Step 5: Documents
        documents: {
            aadhaarCard: {
                required: true,
                uploaded: false,
                name: '',
                size: 0,
                type: '',
                url: null
            },
            panCard: {
                required: true,
                uploaded: false,
                name: '',
                size: 0,
                type: '',
                url: null
            },
            degreeCertificate: {
                required: false,
                uploaded: false,
                name: '',
                size: 0,
                type: '',
                url: null
            },
            experienceLetter: {
                required: false,
                uploaded: false,
                name: '',
                size: 0,
                type: '',
                url: null
            }
        }
    },

    // ========== ATTENDANCE DATA ==========
    attendance: {
        today: {
            checkIn: '09:00 AM',
            checkOut: null,
            status: 'present',
            totalHours: 0
        },
        thisMonth: {
            present: 18,
            absent: 2,
            late: 1,
            halfDay: 1,
            totalDays: 22
        },
        weeklyData: [
            { day: 'Mon', hours: 8, status: 'present' },
            { day: 'Tue', hours: 7.5, status: 'present' },
            { day: 'Wed', hours: 8, status: 'present' },
            { day: 'Thu', hours: 8.5, status: 'present' },
            { day: 'Fri', hours: 4, status: 'half-day' },
            { day: 'Sat', hours: 0, status: 'weekend' },
            { day: 'Sun', hours: 0, status: 'weekend' }
        ],
        monthlyAttendance: [18, 19, 20, 18, 17, 19, 20, 18, 19, 17, 18, 16]
    },

    // ========== TASKS DATA ==========
    tasks: {
        completed: 24,
        inProgress: 8,
        pending: 5,
        overdue: 2,
        weeklyProgress: [65, 70, 75, 80, 85, 88, 90],
        priorityTasks: [
            {
                id: 1,
                title: 'Complete Q4 Report',
                priority: 'high',
                dueDate: '2024-12-20',
                status: 'in-progress',
                assignee: 'Alex Mercer'
            },
            {
                id: 2,
                title: 'Review Pull Request #234',
                priority: 'medium',
                dueDate: '2024-12-18',
                status: 'pending',
                assignee: 'Alex Mercer'
            },
            {
                id: 3,
                title: 'Update Documentation',
                priority: 'low',
                dueDate: '2024-12-25',
                status: 'pending',
                assignee: 'Alex Mercer'
            },
            {
                id: 4,
                title: 'Client Meeting Preparation',
                priority: 'high',
                dueDate: '2024-12-17',
                status: 'completed',
                assignee: 'Alex Mercer'
            }
        ]
    },

    // ========== LEAVE DATA ==========
    leave: {
        total: 20,
        used: 2,
        remaining: 18,
        pending: 1,
        approved: 2,
        rejected: 0,
        upcomingLeaves: [
            {
                id: 1,
                type: 'Annual Leave',
                startDate: '2024-12-23',
                endDate: '2024-12-27',
                days: 5,
                status: 'approved'
            }
        ],
        leaveHistory: [
            {
                id: 1,
                type: 'Sick Leave',
                startDate: '2024-11-15',
                endDate: '2024-11-16',
                days: 2,
                status: 'approved'
            }
        ]
    },

    // ========== PAYROLL DATA ==========
    payroll: {
        monthlySalary: 75000,
        currency: 'INR',
        nextPayDate: '2024-12-30',
        lastPayDate: '2024-11-30',
        yearToDate: 49500,
        taxDeductions: 900,
        netPay: 3600,
        salaryHistory: [
            { month: 'Jan', amount: 4500 },
            { month: 'Feb', amount: 4500 },
            { month: 'Mar', amount: 4500 },
            { month: 'Apr', amount: 4600 },
            { month: 'May', amount: 4600 },
            { month: 'Jun', amount: 4600 },
            { month: 'Jul', amount: 4700 },
            { month: 'Aug', amount: 4700 },
            { month: 'Sep', amount: 4700 },
            { month: 'Oct', amount: 4800 },
            { month: 'Nov', amount: 4800 },
            { month: 'Dec', amount: 4800 }
        ]
    },

    // ========== RECENT ACTIVITIES ==========
    activities: [
        {
            id: 1,
            type: 'task',
            action: 'Completed task',
            title: 'Update user authentication flow',
            timestamp: '2024-12-17T10:30:00',
            user: 'Alex Mercer'
        },
        {
            id: 2,
            type: 'attendance',
            action: 'Checked in',
            title: 'Morning check-in',
            timestamp: '2024-12-17T09:00:00',
            user: 'Alex Mercer'
        },
        {
            id: 3,
            type: 'leave',
            action: 'Leave request',
            title: 'Annual leave request submitted',
            timestamp: '2024-12-16T14:15:00',
            user: 'Alex Mercer'
        },
        {
            id: 4,
            type: 'task',
            action: 'Started task',
            title: 'API documentation update',
            timestamp: '2024-12-16T11:00:00',
            user: 'Alex Mercer'
        },
        {
            id: 5,
            type: 'payroll',
            action: 'Salary credited',
            title: 'November salary processed',
            timestamp: '2024-11-30T09:00:00',
            user: 'Alex Mercer'
        }
    ],

    // ========== UPCOMING EVENTS ==========
    events: [
        {
            id: 1,
            name: 'Team Meeting',
            type: 'meeting',
            date: '2024-12-18',
            time: '10:00 AM',
            location: 'Conference Room A',
            attendees: 8
        },
        {
            id: 2,
            name: 'Project Deadline',
            type: 'deadline',
            date: '2024-12-20',
            project: 'Q4 Feature Release'
        },
        {
            id: 3,
            name: 'Company Holiday Party',
            type: 'event',
            date: '2024-12-22',
            time: '6:00 PM',
            location: 'Grand Ballroom'
        },
        {
            id: 4,
            name: 'Performance Review',
            type: 'meeting',
            date: '2024-12-26',
            time: '2:00 PM',
            with: 'Sarah Johnson (Manager)'
        }
    ],

    // ========== NOTIFICATIONS ==========
    notifications: [
        {
            id: 1,
            title: 'Leave Request Approved',
            message: 'Your annual leave request for Dec 23-27 has been approved.',
            type: 'success',
            read: false,
            timestamp: '2024-12-17T09:30:00'
        },
        {
            id: 2,
            title: 'New Task Assigned',
            message: 'You have been assigned a new task: "Update documentation".',
            type: 'info',
            read: false,
            timestamp: '2024-12-17T08:15:00'
        },
        {
            id: 3,
            title: 'Meeting Reminder',
            message: 'Team meeting tomorrow at 10:00 AM in Conference Room A.',
            type: 'warning',
            read: true,
            timestamp: '2024-12-16T16:00:00'
        }
    ],

    // ========== HELPER METHODS ==========
    
    // Get complete profile data
    getProfileData: function() {
        return this.employeeProfile;
    },

    // Update profile data
    updateProfileData: function(section, data) {
        if (this.employeeProfile[section]) {
            this.employeeProfile[section] = { ...this.employeeProfile[section], ...data };
            return true;
        }
        return false;
    },

    // Get personal information
    getPersonalInfo: function() {
        return this.employeeProfile.personalInfo;
    },

    // Get job details
    getJobDetails: function() {
        return this.employeeProfile.jobDetails;
    },

    // Get contact information
    getContactInfo: function() {
        return this.employeeProfile.contactInfo;
    },

    // Get education records
    getEducation: function() {
        return this.employeeProfile.education;
    },

    // Add education record
    addEducation: function(education) {
        const newId = Math.max(0, ...this.employeeProfile.education.map(e => e.id)) + 1;
        this.employeeProfile.education.push({ id: newId, ...education });
        return newId;
    },

    // Update education record
    updateEducation: function(id, data) {
        const index = this.employeeProfile.education.findIndex(e => e.id === id);
        if (index !== -1) {
            this.employeeProfile.education[index] = { ...this.employeeProfile.education[index], ...data };
            return true;
        }
        return false;
    },

    // Delete education record
    deleteEducation: function(id) {
        const index = this.employeeProfile.education.findIndex(e => e.id === id);
        if (index !== -1) {
            this.employeeProfile.education.splice(index, 1);
            return true;
        }
        return false;
    },

    // Get family details
    getFamilyDetails: function() {
        return this.employeeProfile.familyDetails;
    },

    // Add family member
    addFamilyMember: function(member) {
        const newId = Math.max(0, ...this.employeeProfile.familyDetails.map(f => f.id)) + 1;
        this.employeeProfile.familyDetails.push({ id: newId, ...member });
        return newId;
    },

    // Update family member
    updateFamilyMember: function(id, data) {
        const index = this.employeeProfile.familyDetails.findIndex(f => f.id === id);
        if (index !== -1) {
            this.employeeProfile.familyDetails[index] = { ...this.employeeProfile.familyDetails[index], ...data };
            return true;
        }
        return false;
    },

    // Delete family member
    deleteFamilyMember: function(id) {
        const index = this.employeeProfile.familyDetails.findIndex(f => f.id === id);
        if (index !== -1) {
            this.employeeProfile.familyDetails.splice(index, 1);
            return true;
        }
        return false;
    },

    // Get work experience
    getWorkExperience: function() {
        return this.employeeProfile.workExperience;
    },

    // Add work experience
    addWorkExperience: function(experience) {
        const newId = Math.max(0, ...this.employeeProfile.workExperience.map(w => w.id)) + 1;
        this.employeeProfile.workExperience.push({ id: newId, ...experience });
        return newId;
    },

    // Update work experience
    updateWorkExperience: function(id, data) {
        const index = this.employeeProfile.workExperience.findIndex(w => w.id === id);
        if (index !== -1) {
            this.employeeProfile.workExperience[index] = { ...this.employeeProfile.workExperience[index], ...data };
            return true;
        }
        return false;
    },

    // Delete work experience
    deleteWorkExperience: function(id) {
        const index = this.employeeProfile.workExperience.findIndex(w => w.id === id);
        if (index !== -1) {
            this.employeeProfile.workExperience.splice(index, 1);
            return true;
        }
        return false;
    },

    // Get documents
    getDocuments: function() {
        return this.employeeProfile.documents;
    },

    // Update document
    updateDocument: function(docType, data) {
        const docKey = this.getDocumentKey(docType);
        if (this.employeeProfile.documents[docKey]) {
            this.employeeProfile.documents[docKey] = { ...this.employeeProfile.documents[docKey], ...data };
            return true;
        }
        return false;
    },

    // Helper to get document key
    getDocumentKey: function(docType) {
        const mapping = {
            'Aadhaar Card': 'aadhaarCard',
            'PAN Card': 'panCard',
            'Degree Certificate': 'degreeCertificate',
            'Experience Letter': 'experienceLetter'
        };
        return mapping[docType] || docType.toLowerCase().replace(/\s/g, '');
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MockData;
}