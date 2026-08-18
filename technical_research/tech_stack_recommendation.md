# Technology Stack Research & Recommendation for ARP

Based on the requirements of the Automated Ranking Portal (ARP) at IIT Mandi, here is an extensive analysis and recommendation for the technology stack. 

## Project Scale and Characteristics
* **User Base:** ~10,000 potential users (students, faculty, Nodal Officers, Admins). This is a moderately sized user base, meaning traffic will not be in the millions, but it may experience high-concurrency spikes during submission deadlines.
* **Workloads:** 
  * **Heavy Data Processing:** Parsing multimodal files (Excel, Word, PDFs).
  * **AI/LLM Integration:** Analyzing historical trends, spotting discrepancies, and natural language querying.
  * **Public Visualizations:** Fast, cached delivery of year-wise ranking trends to public visitors.
* **Longevity:** Needs to be easily modifiable and maintainable by future student teams.

---

## 1. Architecture: Serverless vs. Serverful

### **Serverless (e.g., Vercel API routes, AWS Lambda)**
* **Pros:** Auto-scales infinitely, zero server maintenance, pay-for-what-you-use.
* **Cons:** **Timeout Limits & Memory Constraints.** Serverless functions typically have execution timeouts (e.g., 10 to 60 seconds). If a Nodal Officer uploads a 50-page PDF or a massive Excel sheet that needs AI discrepancy flagging, a serverless function will likely timeout before the LLM or processing script finishes.

### **Serverful / Containerized (e.g., Docker, AWS ECS, VMs)**
* **Pros:** No timeout limits. Can run heavy background tasks (like document extraction and AI analysis) asynchronously using job queues (e.g., Celery or Redis Queues). Easily deployable on the Institute's on-premise servers.
* **Cons:** Requires slight infrastructure management.

**Recommendation:** **Hybrid Architecture.** 
Host the Frontend on a serverless platform (for fast, edge-cached delivery) and the Backend on a containerized server (to handle heavy file parsing and AI workloads without timeouts).

---

## 2. Frontend: Next.js vs. React (SPA)

### **React (Single Page Application)**
* **Pros:** Simple, highly modular.
* **Cons:** Slower initial load times. Poor SEO (Search Engine Optimization), which is a significant drawback for the **Public-Facing Portal** that displays ranking data and comparisons.

### **Next.js (App Router)**
* **Pros:** 
  * **Server-Side Rendering (SSR) & Static Site Generation (SSG):** Perfect for the public-facing ranking dashboards. Data can be cached and delivered instantly to visitors.
  * **SEO Friendly:** Essential if the institute wants the public ranking pages to be discoverable.
  * **Developer Experience:** Built-in routing, optimized image handling, and easy API routes.

**Recommendation:** **Next.js (TypeScript).** It perfectly balances a secure, dynamic dashboard for Nodal Officers and blazing-fast, SEO-friendly static pages for the public.
* **Styling:** **Tailwind CSS** + **Shadcn UI** (Provides highly professional, accessible components right out of the box, drastically speeding up UI development).
* **Charts/Visualizations:** **Recharts** or **Chart.js** for comparative ranking analytics.

---

## 3. Backend: Python vs. Node.js

While Node.js (Express/NestJS) is standard for many web apps, ARP is heavily dependent on **data extraction (Excel/PDF), data unification, and AI/LLM integration.**

* **Node.js:** Excellent for high I/O, but lacks native robust libraries for advanced data science, PDF extraction, and complex AI orchestration. You would likely end up writing Python scripts and calling them from Node, which is messy.
* **Python (FastAPI):** Python is the undisputed king of data and AI. 
  * `pandas` makes unifying complex Excel sheets trivial.
  * `PyMuPDF` or `pdfplumber` are industry standards for PDF extraction.
  * `LangChain` or `LlamaIndex` make LLM/Agent integration seamless.
  * **FastAPI** provides blazing fast API routing with auto-generated Swagger documentation and native asynchronous support.

**Recommendation:** **Python with FastAPI.** It naturally supports the multimodal data processing and AI agent requirements of the platform.

---

## 4. Database & Storage

### **Relational vs. NoSQL**
The system heavily relies on structured relationships (Organogram $\rightarrow$ Department $\rightarrow$ Nodal Officer $\rightarrow$ Ranking Metric). A NoSQL database (like MongoDB) would become messy when mapping these strict relationships and generating complex reports.

**Recommendation:** **PostgreSQL.**
* Highly reliable, ACID-compliant (crucial for audit logs and maker-checker workflows).
* Excellent support for JSONB fields if some ranking agency schemas require flexible data structures.
* **ORM:** **SQLAlchemy** or **SQLModel** (integrates perfectly with FastAPI).

### **File Storage (Proofs & Documents)**
You cannot store 10,000 users' multimodal proofs in a database.
* **Recommendation:** **Object Storage (AWS S3, MinIO, or Cloudflare R2).** MinIO is highly recommended if the institute wants to self-host the storage on their own servers for privacy, as it is S3-compatible.

---

## 5. Background Processing (Job Queue)

Because file ingestion and AI-assisted discrepancy flagging can take time, the user shouldn't have to stare at a loading screen.
* **Recommendation:** **Celery + Redis** (or a lighter alternative like FastAPI Background Tasks / RQ). When a user uploads a batch of files, the backend immediately returns a "Processing" status, while a background worker parses the Excel/PDF and runs the AI checks.

---

## Summary of the Recommended Tech Stack

| Component | Technology | Justification |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js (TypeScript) | SSR for fast public pages, great DX, highly scalable. |
| **UI \& Styling** | Tailwind CSS + Shadcn UI | Rapid, professional, and accessible UI development. |
| **Backend Framework** | Python (FastAPI) | Native ecosystem for AI, Pandas (Excel), and PDFs. |
| **Primary Database** | PostgreSQL | Relational integrity for organogram and audit logs. |
| **File Storage** | AWS S3 or MinIO | Scalable storage for PDF/Word/Excel proofs. |
| **Background Jobs** | Celery \& Redis | Prevents timeouts during long AI/Document parsing. |
| **AI Integration** | LangChain + Gemini/Claude | Seamless integration with LLM APIs for error spotting. |
| **Deployment Strategy** | Docker + Vercel + VMs | Frontend on Vercel for edge speed; Backend/DB containerized via Docker for deployment on Institute's on-prem servers or AWS. |

### Why this is scalable and modifiable for 10k users:
1. **Decoupled Architecture:** Frontend and Backend are separate. If the frontend UI needs a total rewrite in 4 years, the Python API remains untouched.
2. **Containerization:** Using Docker means any future student can spin up the exact environment with a single command (`docker-compose up`), eliminating "it works on my machine" issues.
3. **Stateless Backend:** The FastAPI backend will be stateless, meaning you can spin up 5 instances of it during high-traffic deadline days to support thousands of concurrent uploads without breaking a sweat.
