/* =========================================================
   BLIMS ADMIN DASHBOARD — PHASE 2 ANALYTICS
   ---------------------------------------------------------
   FRONTEND-ONLY MOCK DATA


   IMPORTANT:
   - This file is an ADD-ON.
   - DO NOT modify admin-dashboard.js.
   - Uses the EXISTING analytics HTML elements.
   - Backend/API integration will replace the mock data later.
========================================================= */

/* =========================================================
   NEW CODE — MOCK DATA
========================================================= */

const DASHBOARD_PHASE2_MOCK = {
  enrollment: {
    5: [],
    10: [],
  },

  attendance: {
    today: {
      present: 1168,
      absent: 77,
    },

    week: [
      { day: "Mon", present: 1184, absent: 61 },
      { day: "Tue", present: 1192, absent: 53 },
      { day: "Wed", present: 1175, absent: 70 },
      { day: "Thu", present: 1201, absent: 44 },
      { day: "Fri", present: 1168, absent: 77 },
    ],

    month: [
      { day: "Week 1", rate: 95.2 },
      { day: "Week 2", rate: 96.1 },
      { day: "Week 3", rate: 94.8 },
      { day: "Week 4", rate: 96.4 },
    ],
  },

  grades: [
    { grade: "Grade 1", count: 188 },
    { grade: "Grade 2", count: 201 },
    { grade: "Grade 3", count: 214 },
    { grade: "Grade 4", count: 225 },
    { grade: "Grade 5", count: 207 },
    { grade: "Grade 6", count: 210 },
  ],
};

/* =========================================================
   NEW CODE — ENROLLMENT TREND
========================================================= */

async function loadEnrollmentTrend() {
  try {
    const response = await fetch("/api/admin/dashboard", {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load enrollment data.");
    }

    const result = await response.json();

    if (!result.ok || !Array.isArray(result.enrollmentTrend)) {
      throw new Error("Invalid enrollment trend response.");
    }

    const enrollmentData = result.enrollmentTrend
      .filter(
        (item) =>
          item &&
          typeof item.schoolYearName === "string" &&
          Number.isFinite(Number(item.totalStudents)),
      )
      .map((item) => ({
        year: item.schoolYearName,
        count: Number(item.totalStudents),
      }));

    DASHBOARD_PHASE2_MOCK.enrollment[5] = enrollmentData.slice(-5);

    DASHBOARD_PHASE2_MOCK.enrollment[10] = enrollmentData.slice(-10);

    renderEnrollmentTrend(
      String(document.getElementById("enrollmentRange")?.value || "")
        .toLowerCase()
        .includes("10")
        ? 10
        : 5,
    );

    const note = document.getElementById("enrollmentNote");

    if (note) {
      note.textContent = enrollmentData.length
        ? "Enrollment totals are based on recorded BLIMS enrollment history."
        : "No enrollment history is available for the recorded school years.";
    }
  } catch (error) {
    console.error("Enrollment trend loading error:", error);

    const note = document.getElementById("enrollmentNote");

    if (note) {
      note.textContent =
        "Unable to load enrollment history. Please try refreshing the dashboard.";
    }
  }
}

function setupEnrollmentTrend() {
  const select = document.getElementById("enrollmentRange");

  if (!select) return;

  function getRange() {
    return String(select.value).toLowerCase().includes("10") ? 10 : 5;
  }

  select.addEventListener("change", () => {
    renderEnrollmentTrend(getRange());
  });

  renderEnrollmentTrend(getRange());
}

function renderEnrollmentTrend(range = 5) {
  const chart = document.getElementById("enrollmentChart");

  const line = document.getElementById("enrollmentLine");

  const area = document.getElementById("enrollmentArea");

  const pointsGroup = document.getElementById("enrollmentPoints");

  const xAxis = document.getElementById("enrollmentXAxis");

  const yAxis = document.getElementById("enrollmentYAxis");

  const summary = document.getElementById("enrollmentSummary");

  if (!chart || !line || !pointsGroup) return;

  const data = DASHBOARD_PHASE2_MOCK.enrollment[range] || [];

  if (!data.length) {
    if (line) line.setAttribute("points", "");
    if (area) area.setAttribute("d", "");
    if (pointsGroup) pointsGroup.innerHTML = "";
    if (xAxis) xAxis.innerHTML = "";
    if (yAxis) yAxis.innerHTML = "";

    if (summary) {
      summary.innerHTML = "<span>No enrollment data available</span>";
      summary.removeAttribute("title");
    }

    return;
  }

  const width = 560;
  const height = 190;

  const left = 8;
  const right = 8;
  const top = 16;
  const bottom = 20;

  const chartWidth = width - left - right;

  const chartHeight = height - top - bottom;

  const values = data.map((item) => item.count);

  const minValue = Math.min(...values);

  const maxValue = Math.max(...values);

  const valueRange = maxValue - minValue || 1;

  const points = data.map((item, index) => {
    const x = left + (index / Math.max(data.length - 1, 1)) * chartWidth;

    const y =
      top + chartHeight - ((item.count - minValue) / valueRange) * chartHeight;

    return {
      x,
      y,
      ...item,
    };
  });

  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  line.setAttribute("points", linePoints);

  if (area) {
    const areaPath = [
      `M ${points[0].x} ${top + chartHeight}`,

      ...points.map((point) => `L ${point.x} ${point.y}`),

      `L ${points[points.length - 1].x} ${top + chartHeight}`,

      "Z",
    ].join(" ");

    area.setAttribute("d", areaPath);
  }

  pointsGroup.innerHTML = points
    .map((point) => {
      return `
        <circle
          cx="${point.x}"
          cy="${point.y}"
          r="4.5"
        >
          <title>
            ${point.year}: ${point.count.toLocaleString()} learners
          </title>
        </circle>
      `;
    })
    .join("");

  if (xAxis) {
    xAxis.innerHTML = points
      .map((point) => {
        return `
          <span>
            ${point.year}
          </span>
        `;
      })
      .join("");
  }

  if (yAxis) {
    const labels = [
      maxValue,
      Math.round(minValue + valueRange * 0.75),
      Math.round(minValue + valueRange * 0.5),
      Math.round(minValue + valueRange * 0.25),
      minValue,
    ];

    yAxis.innerHTML = labels
      .map(
        (value) => `
        <span>
          ${value.toLocaleString()}
        </span>
      `,
      )
      .join("");
  }

  if (summary) {
    const current = data[data.length - 1];

    const previous = data[data.length - 2];

    summary.innerHTML = `


      <span>
        Current school year
      </span>


      <strong>
        ${current.count.toLocaleString()} learners
      </strong>


    `;

    if (previous) {
      const change = current.count - previous.count;

      const percentage = previous.count ? (change / previous.count) * 100 : 0;

      summary.title = `${change >= 0 ? "+" : ""}${change.toLocaleString()} learners (${percentage.toFixed(1)}%) from the previous school year.`;
    }
  }
}

/* =========================================================
   NEW CODE — ATTENDANCE OVERVIEW
========================================================= */

let attendanceRecords = [];

async function loadAttendanceOverview() {
  const note = document.getElementById("attendanceNote");

  try {
    const response = await fetch("/api/admin/attendance", {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load attendance records.");
    }

    const result = await response.json();

    if (!result.ok || !Array.isArray(result.data)) {
      throw new Error("Invalid attendance response.");
    }

    attendanceRecords = result.data.filter(
      (record) =>
        record &&
        /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
        ["present", "absent", "late", "excused"].includes(record.status),
    );

    updateAttendanceMockData();

    // Update Today's Attendance KPI using today's real attendance records.
    const attendanceKpi = document.getElementById("statAttendance");
    const attendanceKpiHelper = document.getElementById("statAttendanceHelper");

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const todayRecords = attendanceRecords.filter(
      (record) => record.date === today,
    );

    const presentCount = todayRecords.filter(
      (record) => record.status === "present",
    ).length;

    const absentCount = todayRecords.filter(
      (record) => record.status === "absent",
    ).length;

    const lateCount = todayRecords.filter(
      (record) => record.status === "late",
    ).length;

    const excusedCount = todayRecords.filter(
      (record) => record.status === "excused",
    ).length;

    const totalCount = presentCount + absentCount + lateCount + excusedCount;

    const attendanceRate = totalCount
      ? (presentCount / totalCount) * 100
      : null;

    if (attendanceKpi) {
      attendanceKpi.textContent =
        attendanceRate === null ? "—" : `${attendanceRate.toFixed(1)}%`;
    }

    if (attendanceKpiHelper) {
      attendanceKpiHelper.textContent =
        totalCount === 0
          ? "No attendance recorded today"
          : `${presentCount} present · ${absentCount} absent`;
    }

    if (note) {
      note.textContent = attendanceRecords.length
        ? "Attendance totals are based on recorded BLIMS attendance."
        : "No attendance records are available for the selected periods.";
    }

    renderAttendanceOverview(
      String(
        document.getElementById("attendancePeriod")?.value || "Today",
      ).toLowerCase(),
    );
  } catch (error) {
    console.error("Attendance overview loading error:", error);

    if (note) {
      note.textContent =
        "Unable to load attendance records. Please refresh the dashboard.";
    }
  }
}

function updateAttendanceMockData() {
  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  const today = new Date();
  const todayKey = formatDate(today);

  const getCounts = (records) => {
    const counts = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };

    records.forEach((record) => {
      counts[record.status] += 1;
    });

    return counts;
  };

  const startOfWeek = new Date(today);
  const mondayOffset = (today.getDay() + 6) % 7;
  startOfWeek.setDate(today.getDate() - mondayOffset);

  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);

    const key = formatDate(date);
    const counts = getCounts(
      attendanceRecords.filter((record) => record.date === key),
    );

    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      ...counts,
    };
  });

  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const month = [];

  for (let weekIndex = 0; weekIndex < 5; weekIndex += 1) {
    const firstDay = new Date(monthStart);
    firstDay.setDate(1 + weekIndex * 7);

    if (firstDay > monthEnd) break;

    const lastDay = new Date(firstDay);
    lastDay.setDate(firstDay.getDate() + 6);

    if (lastDay > monthEnd) {
      lastDay.setTime(monthEnd.getTime());
    }

    const startKey = formatDate(firstDay);
    const endKey = formatDate(lastDay);

    const counts = getCounts(
      attendanceRecords.filter(
        (record) => record.date >= startKey && record.date <= endKey,
      ),
    );

    const total = counts.present + counts.absent + counts.late + counts.excused;

    month.push({
      day: `Week ${weekIndex + 1}`,
      rate: total ? (counts.present / total) * 100 : null,
    });
  }

  DASHBOARD_PHASE2_MOCK.attendance.today = getCounts(
    attendanceRecords.filter((record) => record.date === todayKey),
  );

  DASHBOARD_PHASE2_MOCK.attendance.week = week;
  DASHBOARD_PHASE2_MOCK.attendance.month = month;
}

function setupAttendanceOverview() {
  const select = document.getElementById("attendancePeriod");

  if (!select) return;

  select.addEventListener("change", () => {
    renderAttendanceOverview(String(select.value).toLowerCase());
  });

  renderAttendanceOverview(String(select.value).toLowerCase());
  loadAttendanceOverview();
}

function renderAttendanceOverview(period) {
  const preview = document.getElementById("attendancePreview");

  if (!preview) return;

  if (period.includes("week")) {
    renderWeeklyAttendance(preview);

    return;
  }

  if (period.includes("month")) {
    renderMonthlyAttendance(preview);

    return;
  }

  renderTodayAttendance(preview);
}

/* ---------------------------------------------------------
   TODAY
--------------------------------------------------------- */

function renderTodayAttendance(preview) {
  const data = DASHBOARD_PHASE2_MOCK.attendance.today;

  const total =
    data.present + data.absent + (data.late || 0) + (data.excused || 0);

  const rate = total ? (data.present / total) * 100 : 0;

  const donut = document.getElementById("attendanceDonut");

  const center = document.getElementById("attendanceCenterRate");

  const present = document.getElementById("attendancePresent");

  const absent = document.getElementById("attendanceAbsent");

  const totalEl = document.getElementById("attendanceTotal");

  if (donut) {
    donut.style.background = `conic-gradient(
        #10b981 0deg ${rate * 3.6}deg,
        #f06b72 ${rate * 3.6}deg 360deg
      )`;
  }

  if (center) {
    center.textContent = `${rate.toFixed(1)}%`;
  }

  if (present) {
    present.textContent = data.present.toLocaleString();
  }

  if (absent) {
    absent.textContent = data.absent.toLocaleString();
  }

  if (totalEl) {
    totalEl.textContent = total.toLocaleString();
  }

  renderAttendanceLegendLayout(preview);
}

/* ---------------------------------------------------------
   WEEK
--------------------------------------------------------- */

function renderWeeklyAttendance(preview) {
  const data = DASHBOARD_PHASE2_MOCK.attendance.week;

  const maxTotal = Math.max(
    1,
    ...data.map(
      (item) =>
        item.present + item.absent + (item.late || 0) + (item.excused || 0),
    ),
  );

  preview.innerHTML = `


    <div class="attendance-week-chart"
         style="
           width:100%;
           height:100%;
           display:flex;
           align-items:flex-end;
           justify-content:space-between;
           gap:12px;
           padding:14px 8px 8px;
         ">


      ${data
        .map((item) => {
          const total =
            item.present + item.absent + (item.late || 0) + (item.excused || 0);

          const presentHeight = (item.present / maxTotal) * 100;
          const absentHeight = (item.absent / maxTotal) * 100;
          const rate = total ? (item.present / total) * 100 : 0;

          return `


          <div
            style="
              flex:1;
              height:100%;
              display:flex;
              flex-direction:column;
              align-items:center;
              justify-content:flex-end;
              gap:5px;
            "
          >


            <span
              style="
                font-size:8px;
                font-weight:800;
                color:rgba(11,44,74,.58);
              "
            >
              ${rate.toFixed(1)}%
            </span>




            <div
              title="${item.day}: ${item.present} present, ${item.absent} absent"
              style="
                width:min(34px,70%);
                height:150px;
                max-height:72%;
                min-height:45px;
                display:flex;
                flex-direction:column;
                justify-content:flex-end;
                overflow:hidden;
                border-radius:8px 8px 4px 4px;
                background:#f2f5f7;
              "
            >


              <div
                style="
                  height:${presentHeight}%;
                  background:#10b981;
                "
              ></div>


              <div
                style="
                  height:${absentHeight}%;
                  background:#f06b72;
                "
              ></div>


            </div>




            <span
              style="
                font-size:8px;
                font-weight:800;
                color:rgba(11,44,74,.48);
              "
            >
              ${item.day}
            </span>


          </div>


        `;
        })
        .join("")}


    </div>


  `;
}

/* ---------------------------------------------------------
   MONTH
--------------------------------------------------------- */

function renderMonthlyAttendance(preview) {
  const data = DASHBOARD_PHASE2_MOCK.attendance.month;
  const hasAttendanceData = data.some((item) => Number.isFinite(item.rate));

  const width = 560;
  const height = 170;

  const left = 38;
  const right = 12;
  const top = 15;
  const bottom = 30;

  const chartWidth = width - left - right;

  const chartHeight = height - top - bottom;

  const min = 90;
  const max = 100;

  const points = data.map((item, index) => {
    const x = left + (index / Math.max(data.length - 1, 1)) * chartWidth;

    const y = Number.isFinite(item.rate)
      ? top + chartHeight - ((item.rate - min) / (max - min)) * chartHeight
      : null;

    return {
      x,
      y,
      ...item,
    };
  });

  const validPoints = points.filter((point) => point.y !== null);
  const polyline = validPoints
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  preview.innerHTML = `


    <div
      style="
        width:100%;
        height:100%;
        padding:8px 0;
      "
    >


      <svg
        viewBox="0 0 ${width} ${height}"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        aria-label="Monthly attendance rate"
      >


        ${[90, 95, 100]
          .map((value) => {
            const y =
              top + chartHeight - ((value - min) / (max - min)) * chartHeight;

            return `


            <line
              x1="${left}"
              y1="${y}"
              x2="${width - right}"
              y2="${y}"
              stroke="rgba(11,44,74,.08)"
              stroke-dasharray="3 4"
            />


            <text
              x="${left - 7}"
              y="${y + 3}"
              text-anchor="end"
              font-size="8"
              fill="rgba(11,44,74,.42)"
            >
              ${value}%
            </text>


          `;
          })
          .join("")}




        <polyline
          points="${polyline}"
          fill="none"
          stroke="#1976d2"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />




        ${points
          .filter((point) => point.y !== null)
          .map(
            (point) => `
      <circle
        cx="${point.x}"
        cy="${point.y}"
        r="4"
        fill="#ffffff"
        stroke="#1976d2"
        stroke-width="2.5"
      >
        <title>${point.day}: ${point.rate}%</title>
      </circle>
    `,
          )
          .join("")}

${points
  .map(
    (point) => `
      <text
        x="${point.x}"
        y="${height - 8}"
        text-anchor="middle"
        font-size="8"
        font-weight="700"
        fill="rgba(11,44,74,.45)"
      >
        ${point.day}
      </text>
    `,
  )
  .join("")}


      </svg>


    </div>


  `;
}

/* ---------------------------------------------------------
   RESTORE EXISTING ATTENDANCE LEGEND
--------------------------------------------------------- */

function renderAttendanceLegendLayout(preview) {
  /*
     The existing HTML already contains the legend.
     Do not rebuild it here.
  */

  const note = document.getElementById("attendanceNote");

  if (note) {
    note.textContent = attendanceRecords.length
      ? "Attendance totals are based on recorded BLIMS attendance."
      : "No attendance records are available for the selected periods.";
  }
}

/* =========================================================
   NEW CODE — LEARNERS BY GRADE LEVEL
========================================================= */

let gradeDistributionData = [];
let gradeSchoolYears = [];

function setupGradeDistribution() {
  const container = document.getElementById("gradeBars");
  const select = document.getElementById("gradeSchoolYear");

  if (!container) return;

  if (select) {
    select.addEventListener("change", renderGradeDistribution);
  }

  loadGradeDistribution();
}

async function loadGradeDistribution() {
  const container = document.getElementById("gradeBars");
  const note = document.getElementById("gradeNote");
  const select = document.getElementById("gradeSchoolYear");

  if (!container) return;

  try {
    const response = await fetch("/api/admin/dashboard", {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load grade distribution.");
    }

    const result = await response.json();

    if (
      !result.ok ||
      !Array.isArray(result.gradeDistribution) ||
      !Array.isArray(result.enrollmentTrend)
    ) {
      throw new Error("Invalid grade distribution response.");
    }

    gradeDistributionData = result.gradeDistribution.filter(
      (item) =>
        item &&
        typeof item.schoolYearId === "string" &&
        typeof item.grade === "string" &&
        Number.isFinite(Number(item.count)),
    );

    gradeSchoolYears = result.enrollmentTrend.filter(
      (item) =>
        item &&
        typeof item.schoolYearId === "string" &&
        typeof item.schoolYearName === "string",
    );

    if (select) {
      const previousValue = select.value;

      select.innerHTML = gradeSchoolYears
        .map(
          (year) =>
            `<option value="${year.schoolYearId}">${year.schoolYearName}</option>`,
        )
        .join("");

      if (
        gradeSchoolYears.some((year) => year.schoolYearId === previousValue)
      ) {
        select.value = previousValue;
      } else if (gradeSchoolYears.length) {
        select.value =
          gradeSchoolYears[gradeSchoolYears.length - 1].schoolYearId;
      }
    }

    renderGradeDistribution();

    if (note) {
      note.textContent = gradeDistributionData.length
        ? "Learner counts are based on recorded BLIMS enrollment records."
        : "No enrollment records are available for the recorded school years.";
    }
  } catch (error) {
    console.error("Grade distribution loading error:", error);

    container.innerHTML = "";

    if (note) {
      note.textContent =
        "Unable to load learner distribution. Please refresh the dashboard.";
    }
  }
}

function renderGradeDistribution() {
  const container = document.getElementById("gradeBars");
  const select = document.getElementById("gradeSchoolYear");

  if (!container) return;

  const selectedSchoolYearId = select?.value || "";

  const selectedRecords = gradeDistributionData.filter(
    (item) => item.schoolYearId === selectedSchoolYearId,
  );

  const gradeOrder = [
    "Kindergarten",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
  ];

  const data = gradeOrder.map((grade) => {
    const record = selectedRecords.find((item) => item.grade === grade);

    return {
      grade,
      count: record ? Number(record.count) : 0,
    };
  });

  const maxValue = Math.max(1, ...data.map((item) => item.count));

  container.innerHTML = data
    .map((item) => {
      const height = (item.count / maxValue) * 100;

      const label =
        item.grade === "Kindergarten"
          ? "Kinder"
          : item.grade.replace("Grade ", "G");

      return `
        <div
          class="grade-bar-item"
          style="
            flex:1;
            min-width:24px;
            height:100%;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:flex-end;
            gap:5px;
          "
        >
          <strong
            style="
              font-size:8px;
              color:#0b2c4a;
            "
          >${item.count.toLocaleString()}</strong>

          <div
            title="${item.grade}: ${item.count.toLocaleString()} learners"
            style="
              width:min(34px,70%);
              height:${height}%;
              min-height:${item.count ? 12 : 0}px;
              border-radius:7px 7px 3px 3px;
              background:#1976d2;
            "
          ></div>

          <span
            style="
              font-size:7px;
              line-height:1.1;
              font-weight:800;
              color:rgba(11,44,74,.48);
              white-space:nowrap;
            "
          >${label}</span>
        </div>
      `;
    })
    .join("");
}

/* =========================================================
   NEW CODE — INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  /*
        This file uses elements that already exist
        in dashboard.html.

        No new dashboard cards are created.
        No existing HTML is replaced.
    */

  setupEnrollmentTrend();
  loadEnrollmentTrend();

  setupAttendanceOverview();

  setupGradeDistribution();

  loadDashboardKpis();
});

async function loadDashboardKpis() {
  const learnersElement = document.getElementById("statStudents");
  const facultyElement = document.getElementById("statTeachers");

  if (!learnersElement && !facultyElement) return;

  try {
    const response = await fetch("/api/admin/dashboard", {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load dashboard KPI data.");
    }

    const result = await response.json();

    if (!result.ok) {
      throw new Error("Invalid dashboard KPI response.");
    }

    // Total Learners
    if (learnersElement) {
      const totalLearners = Number(result.stats?.totalStudents);

      learnersElement.textContent = Number.isFinite(totalLearners)
        ? totalLearners.toLocaleString()
        : "—";
    }

    // Total Faculty
    if (facultyElement) {
      const totalFaculty = Number(result.stats?.totalTeachers);

      facultyElement.textContent = Number.isFinite(totalFaculty)
        ? totalFaculty.toLocaleString()
        : "—";
    }
  } catch (error) {
    console.error("Dashboard KPI loading error:", error);

    if (learnersElement) learnersElement.textContent = "—";
    if (facultyElement) facultyElement.textContent = "—";
  }
}

/* =========================================================
   NEW CODE — API INTEGRATION (LATER)
=========================================================


   When backend integration begins, replace
   DASHBOARD_PHASE2_MOCK with data returned by
   the appropriate BLIMS API endpoint.


   Do not connect the API yet.


========================================================= */
