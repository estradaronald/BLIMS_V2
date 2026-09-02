const Announcement = require("../models/Announcement.model");
const Student = require("../models/Student.model");


/* =========================================================
   CONSTANTS
========================================================= */

const VALID_CATEGORIES = [
  "general",
  "events",
  "academic",
  "priority",
];

const VALID_SOURCES = [
  "all",
  "admin",
  "teacher",
];


/* =========================================================
   HELPERS
========================================================= */

function badRequest(
  res,
  message = "Invalid request."
) {
  return res.status(400).json({
    ok: false,
    message,
  });
}


function unauthorized(
  res,
  message = "Unauthorized."
) {
  return res.status(401).json({
    ok: false,
    message,
  });
}


function forbidden(
  res,
  message = "You do not have permission to perform this action."
) {
  return res.status(403).json({
    ok: false,
    message,
  });
}


function serverError(
  res,
  err,
  message = "Server error."
) {
  console.error(
    "Student announcement controller error:",
    err
  );

  return res.status(500).json({
    ok: false,
    message,
  });
}


function normalize(value) {
  return String(
    value ?? ""
  ).trim();
}


/* =========================================================
   USER
========================================================= */

function getUserId(req) {

  return (
    req.session?.user?.id ||
    req.user?.id ||
    req.user?._id ||
    null
  );

}


function getUserRole(req) {

  return String(
    req.session?.user?.role ||
    req.user?.role ||
    ""
  )
    .trim()
    .toLowerCase();

}


function isStudent(req) {

  return (
    getUserRole(req) ===
    "student"
  );

}


/* =========================================================
   STUDENT PROFILE
========================================================= */

async function getStudentProfile(req) {

  const userId =
    getUserId(req);


  if (!userId) {
    return null;
  }


  const student =
    await Student.findOne({
      userId,
      isActive: true,
    })
      .select(
        "userId studentId firstName middleName lastName className sectionName isActive"
      )
      .lean();


  return student;
}


/* =========================================================
   STATUS
========================================================= */

function getStatus(row) {

  if (
    row?.archived === true
  ) {
    return "archived";
  }


  if (
    row?.draft === true
  ) {
    return "draft";
  }


  if (
    row?.publishAt
  ) {

    const publishTime =
      new Date(
        row.publishAt
      ).getTime();


    if (
      !Number.isNaN(
        publishTime
      ) &&
      publishTime >
        Date.now()
    ) {

      return "scheduled";

    }

  }


  return "published";
}


function attachStatus(row) {

  if (!row) {
    return row;
  }


  return {
    ...row,

    status:
      getStatus(row),

  };

}


/* =========================================================
   SOURCE
========================================================= */

function getSource(row) {

  const source =
    normalize(
      row?.source
    ).toLowerCase();


  if (
    source === "teacher"
  ) {
    return "teacher";
  }


  if (
    source === "admin" ||
    source === "administrator"
  ) {
    return "admin";
  }


  /*
   * Backward compatibility for
   * older announcements that may
   * not have source yet.
   */

  const createdByRole =
    normalize(
      row?.createdBy?.role
    ).toLowerCase();


  if (
    createdByRole === "teacher" ||
    createdByRole === "faculty"
  ) {
    return "teacher";
  }


  if (
    createdByRole === "admin" ||
    createdByRole === "administrator"
  ) {
    return "admin";
  }


  /*
   * New announcements should
   * always have source.

   * Unknown source should NOT
   * automatically become visible.
   */

  return "";
}


/* =========================================================
   VISIBILITY
========================================================= */

/*
  STUDENT CAN SEE:

  ---------------------------------------------------------
  ADMIN
  ---------------------------------------------------------

    source   = "admin"

    audience = "all"
    audience = "students"


  ---------------------------------------------------------
  TEACHER
  ---------------------------------------------------------

    source   = "teacher"

    audience = "class"

    className
      must equal student's className

    sectionName
      must equal student's sectionName


  ---------------------------------------------------------
  NEVER
  ---------------------------------------------------------

    audience = "teachers"

    another teacher's class

    draft

    scheduled

    archived
*/


function buildStudentVisibilityQuery(
  student
) {

  const className =
    normalize(
      student.className
    );


  const sectionName =
    normalize(
      student.sectionName
    );


  return {

    /*
     * Students only receive
     * active announcements.
     */

    archived: false,

    draft: false,


    $or: [

      /* =====================================================
         ADMIN ANNOUNCEMENTS
      ===================================================== */

      {

        source:
          "admin",

        audience: {
          $in: [
            "all",
            "students",
          ],
        },

      },


      /* =====================================================
         TEACHER CLASS ANNOUNCEMENTS
      ===================================================== */

      {

        source:
          "teacher",

        audience:
          "class",

        className,

        sectionName,

      },

    ],

  };

}


/* =========================================================
   PUBLICATION QUERY
========================================================= */

function addPublishedCondition(
  query
) {

  query.$and = [

    ...(query.$and || []),

    {

      $or: [

        /*
         * Publish immediately.
         */

        {
          publishAt:
            null,
        },

        /*
         * Scheduled announcement
         * whose publication time
         * has already arrived.
         */

        {
          publishAt: {
            $lte:
              new Date(),
          },
        },

      ],

    },

  ];

}


/* =========================================================
   GET ALL STUDENT ANNOUNCEMENTS
========================================================= */

exports.getStudentAnnouncements =
  async (
    req,
    res
  ) => {

    try {

      /* =====================================================
         STUDENT ONLY
      ===================================================== */

      if (
        !isStudent(req)
      ) {

        return forbidden(
          res,
          "Only students can access student announcements."
        );

      }


      /* =====================================================
         STUDENT PROFILE
      ===================================================== */

      const student =
        await getStudentProfile(
          req
        );


      if (!student) {

        return unauthorized(
          res,
          "Student profile not found."
        );

      }


      /* =====================================================
         STUDENT CLASS / SECTION
      ===================================================== */

      const className =
        normalize(
          student.className
        );


      const sectionName =
        normalize(
          student.sectionName
        );


      if (
        !className ||
        !sectionName
      ) {

        return badRequest(
          res,
          "Student class/section assignment not found."
        );

      }


      /* =====================================================
         QUERY PARAMETERS
      ===================================================== */

      const category =
        normalize(
          req.query?.category ||
          "all"
        );


      const source =
        normalize(
          req.query?.source ||
          "all"
        ).toLowerCase();


      const search =
        normalize(
          req.query?.search ||
          ""
        );


      /* =====================================================
         VALIDATE CATEGORY
      ===================================================== */

      if (
        category !== "all"
      ) {

        if (
          !VALID_CATEGORIES.includes(
            category
          )
        ) {

          return badRequest(
            res,
            "Invalid announcement category."
          );

        }

      }


      /* =====================================================
         VALIDATE SOURCE
      ===================================================== */

      if (
        !VALID_SOURCES.includes(
          source
        )
      ) {

        return badRequest(
          res,
          "Invalid announcement source."
        );

      }


      /* =====================================================
         BUILD BASE VISIBILITY QUERY
      ===================================================== */

      const query =
        buildStudentVisibilityQuery(
          student
        );


      /* =====================================================
         PUBLICATION
      ===================================================== */

      addPublishedCondition(
        query
      );


      /* =====================================================
         CATEGORY FILTER
      ===================================================== */

      if (
        category !== "all"
      ) {

        query.category =
          category;

      }


      /* =====================================================
         SOURCE FILTER
      ===================================================== */

      /*
       * This only narrows the already
       * safe visibility query.

       * It cannot make a teacher-class
       * announcement visible to the
       * wrong student.
       */

      if (
        source !== "all"
      ) {

        query.$and.push({

          source,

        });

      }


      /* =====================================================
         SEARCH
      ===================================================== */

      if (
        search
      ) {

        query.$and.push({

          $or: [

            {
              title: {
                $regex:
                  search,

                $options:
                  "i",
              },
            },

            {
              message: {
                $regex:
                  search,

                $options:
                  "i",
              },
            },

            {
              location: {
                $regex:
                  search,

                $options:
                  "i",
              },
            },

          ],

        });

      }


      /* =====================================================
         FETCH
      ===================================================== */

      let rows =
        await Announcement.find(
          query
        )

          .populate(
            "createdBy",
            "fullName firstName middleName lastName username role"
          )

          .populate(
            "updatedBy",
            "fullName firstName middleName lastName username role"
          )

          .sort({
            createdAt: -1,
          })

          .lean();


      /* =====================================================
         STATUS
      ===================================================== */

      rows =
        rows.map(
          (row) =>
            attachStatus(
              row
            )
        );


      /* =====================================================
         FINAL SAFETY FILTER
      ===================================================== */

      /*
       * Even though MongoDB already
       * restricts publication status,
       * keep this second layer as a
       * defensive check.
       */

      rows =
        rows.filter(
          (row) =>
            row.status ===
            "published"
        );


      /* =====================================================
         RESPONSE
      ===================================================== */

      return res.json({

        ok: true,

        data:
          rows,

        studentScope: {

          className,

          sectionName,

        },

      });

    } catch (err) {

      return serverError(
        res,
        err
      );

    }

  };


/* =========================================================
   GET ONE STUDENT ANNOUNCEMENT
========================================================= */

exports.getStudentAnnouncementById =
  async (
    req,
    res
  ) => {

    try {

      /* =====================================================
         STUDENT ONLY
      ===================================================== */

      if (
        !isStudent(req)
      ) {

        return forbidden(
          res,
          "Only students can access student announcements."
        );

      }


      /* =====================================================
         STUDENT PROFILE
      ===================================================== */

      const student =
        await getStudentProfile(
          req
        );


      if (!student) {

        return unauthorized(
          res,
          "Student profile not found."
        );

      }


      const className =
        normalize(
          student.className
        );


      const sectionName =
        normalize(
          student.sectionName
        );


      if (
        !className ||
        !sectionName
      ) {

        return badRequest(
          res,
          "Student class/section assignment not found."
        );

      }


      /* =====================================================
         FIND
      ===================================================== */

      const row =
        await Announcement.findById(
          req.params.id
        )

          .populate(
            "createdBy",
            "fullName firstName middleName lastName username role"
          )

          .populate(
            "updatedBy",
            "fullName firstName middleName lastName username role"
          )

          .lean();


      if (!row) {

        return res.status(404).json({

          ok: false,

          message:
            "Announcement not found.",

        });

      }


      /* =====================================================
         STATUS
      ===================================================== */

      const result =
        attachStatus(
          row
        );


      /*
       * Students can only access
       * already published announcements.
       */

      if (
        result.status !==
        "published"
      ) {

        return res.status(404).json({

          ok: false,

          message:
            "Announcement not found.",

        });

      }


      /* =====================================================
         SOURCE
      ===================================================== */

      const source =
        getSource(
          result
        );


      let visible =
        false;


      /* =====================================================
         ADMIN ANNOUNCEMENT
      ===================================================== */

      if (
        source === "admin"
      ) {

        visible =
          result.audience ===
            "all" ||

          result.audience ===
            "students";

      }


      /* =====================================================
         TEACHER CLASS ANNOUNCEMENT
      ===================================================== */

      else if (
        source === "teacher"
      ) {

        visible =
          result.audience ===
            "class" &&

          normalize(
            result.className
          ) ===
            className &&

          normalize(
            result.sectionName
          ) ===
            sectionName;

      }


      /* =====================================================
         NOT VISIBLE
      ===================================================== */

      if (
        !visible
      ) {

        return res.status(404).json({

          ok: false,

          message:
            "Announcement not found.",

        });

      }


      /* =====================================================
         RESPONSE
      ===================================================== */

      return res.json({

        ok: true,

        data:
          result,

      });

    } catch (err) {

      return serverError(
        res,
        err
      );

    }

  };