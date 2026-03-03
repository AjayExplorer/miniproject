# Entity-Relationship Diagram

Below is a Mermaid ER diagram representing the main entities and relationships for this Voting Management System.

```mermaid
erDiagram
    ADMINS {
        ObjectId _id PK
        string username
        string passwordHash
        string role "super_admin|tutor_admin|staff_advisor"
        string name
        Date createdAt
    }

    STUDENTS {
        ObjectId _id PK
        string admissionNumber
        string name
        ObjectId tutorId FK
        Array faceEmbedding
        int failedAttempts
        bool verified
    }

    ELECTIONS {
        ObjectId _id PK
        string name
        string type "class|secondary|other"
        Date startDate
        Date endDate
        string status
    }

    CANDIDATES {
        ObjectId _id PK
        ObjectId studentId FK
        ObjectId electionId FK
        string position
    }

    VOTES {
        ObjectId _id PK
        ObjectId studentId FK
        ObjectId candidateId FK
        ObjectId electionId FK
        Date castAt
    }

    VERIFICATION_REQUESTS {
        ObjectId _id PK
        ObjectId studentId FK
        ObjectId requestedBy FK
        string status "pending|approved|rejected"
        string reason
        Date requestedAt
        Date resolvedAt
    }

    ELECTED_REPRESENTATIVES {
        ObjectId _id PK
        ObjectId studentId FK
        ObjectId electionId FK
        string position
    }

    %% Relationships
    ADMINS ||--o{ STUDENTS : "tutor_manages"
    ELECTIONS ||--o{ CANDIDATES : "has"
    STUDENTS ||--o{ CANDIDATES : "may_be"
    STUDENTS ||--o{ VOTES : "casts"
    CANDIDATES ||--o{ VOTES : "receives"
    ELECTIONS ||--o{ VOTES : "in"
    STUDENTS ||--o{ VERIFICATION_REQUESTS : "creates"
    ADMINS ||--o{ VERIFICATION_REQUESTS : "handles"
    ELECTIONS ||--o{ ELECTED_REPRESENTATIVES : "produces"
    STUDENTS ||--o{ ELECTED_REPRESENTATIVES : "is"

    %% Notes: Students can cast up to 2 votes per election; implement logic in application layer.
```

Notes:
- The ER diagram models `VOTES` as individual vote records linking a `STUDENT` to a `CANDIDATE` in an `ELECTION` (one record per selected candidate). This supports the "up to 2 candidates per election" rule by limiting cast operations per `studentId` + `electionId`.
- `faceEmbedding` stores the numeric embedding array (no raw images).

If you want a PNG/SVG export of this diagram or changes to attributes/relations, I can generate or refine it next.
