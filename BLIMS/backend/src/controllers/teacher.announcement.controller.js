const Announcement = require("../models/Announcement.model");
const Teacher = require("../models/Teacher.model");


/* =========================================================
   CONSTANTS
========================================================= */

const VALID_CATEGORIES = [
  "general",
  "events",
  "academic",
  "priority",
];

const VALID_TYPES = [
  "all",
  "published",
  "scheduled",
  "draft",
  "archived",
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
    "Teacher announcement controller error:",
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


function toBoolean(value) {
  return (
    value === true ||
    String(value).toLowerCase() === "true"
  );
}


function parseDate(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
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


function isTeacher(req) {

  const role =
    getUserRole(req);

  return (
    role === "teacher" ||
    role === "faculty"
  );

}


/* =========================================================
   TEACHER ASSIGNMENT
========================================================= */

/*
  IMPORTANT:

  Teacher class/section is stored in:

    teachers collection

  Example:

    userId: ObjectId("...")
    teacherId: "TCH-0059"
    className: "Kindergarten"
    sectionName: "Everlasting"

  We use the authenticated user's ID to find
  the Teacher document.

  We DO NOT trust:

    req.body.className
    req.body.sectionName
    req.query.className
    req.query.sectionName

  for the teacher's actual assignment.
*/


async function getTeacherAssignment(req) {

  const userId =
    getUserId(req);

  if (!userId) {
    return null;
  }

  const teacher =
    await Teacher.findOne({
      userId: userId,
    })
      .select(
        "userId teacherId className sectionName isActive"
      )
      .lean();

  if (!teacher) {
    return null;
  }

  return {
    className:
      normalize(
        teacher.className
      ),

    sectionName:
      normalize(
        teacher.sectionName
      ),
  };

}


function hasValidTeacherScope(
  scope
) {

  return (
    !!normalize(
      scope?.className
    ) &&
    !!normalize(
      scope?.sectionName
    )
  );

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
      getStatus(
        row
      ),
  };

}


/* =========================================================
   OWNERSHIP
========================================================= */

function getCreatedById(row) {

  if (!row?.createdBy) {
    return null;
  }

  if (
    typeof row.createdBy ===
    "object"
  ) {

    return String(
      row.createdBy._id ||
      row.createdBy.id ||
      ""
    );

  }

  return String(
    row.createdBy
  );

}


function isOwnedByTeacher(
  row,
  teacherId
) {

  if (
    !row ||
    !teacherId
  ) {
    return false;
  }

  return (
    getCreatedById(
      row
    ) ===
    String(
      teacherId
    )
  );

}


/* =========================================================
   CATEGORY
========================================================= */

function validateCategory(
  res,
  category
) {

  if (
    !VALID_CATEGORIES.includes(
      category
    )
  ) {

    badRequest(
      res,
      "Invalid announcement category."
    );

    return false;
  }

  return true;
}


/* =========================================================
   PUBLICATION
========================================================= */

/*
  Publish Now:

    draft = false
    publishAt = null

  Schedule Later:

    draft = false
    publishAt = future date

  Draft:

    draft = true
    publishAt = null
*/

function resolvePublication(req) {

  const draft =
    toBoolean(
      req.body?.draft
    );


  /* -------------------------------------------------------
     DRAFT
  ------------------------------------------------------- */

  if (draft) {

    return {
      ok: true,

      draft: true,

      publishAt: null,
    };

  }


  /* -------------------------------------------------------
     PUBLISH NOW
  ------------------------------------------------------- */

  const rawPublishAt =
    req.body?.publishAt;


  if (
    rawPublishAt === null ||
    rawPublishAt === undefined ||
    rawPublishAt === ""
  ) {

    return {
      ok: true,

      draft: false,

      publishAt: null,
    };

  }


  /* -------------------------------------------------------
     SCHEDULE
  ------------------------------------------------------- */

  const publishAt =
    parseDate(
      rawPublishAt
    );


  if (!publishAt) {

    return {
      ok: false,

      message:
        "Invalid publish date.",
    };

  }


  if (
    publishAt.getTime() <=
    Date.now()
  ) {

    return {
      ok: false,

      message:
        "Scheduled publication date must be in the future.",
    };

  }


  return {
    ok: true,

    draft: false,

    publishAt,
  };

}


/* =========================================================
   CREATE TEACHER ANNOUNCEMENT
========================================================= */

exports.createTeacherAnnouncement =
  async (
    req,
    res
  ) => {

    try {

      /* -----------------------------------------------------
         TEACHER ONLY
      ----------------------------------------------------- */

      if (
        !isTeacher(req)
      ) {

        return forbidden(
          res,
          "Only teachers can create teacher announcements."
        );

      }


      const teacherId =
        getUserId(req);


      if (!teacherId) {

        return unauthorized(
          res,
          "Teacher session not found."
        );

      }


      /* -----------------------------------------------------
         BASIC FIELDS
      ----------------------------------------------------- */

      const title =
        normalize(
          req.body?.title
        );


      const message =
        normalize(
          req.body?.message
        );


      const category =
        normalize(
          req.body?.category ||
          "general"
        );


      if (!title) {

        return badRequest(
          res,
          "Title is required."
        );

      }


      if (!message) {

        return badRequest(
          res,
          "Message is required."
        );

      }


      if (
        !validateCategory(
          res,
          category
        )
      ) {
        return;
      }


      /* -----------------------------------------------------
         GET TEACHER ASSIGNMENT FROM DATABASE
      ----------------------------------------------------- */

      const teacherScope =
        await getTeacherAssignment(
          req
        );


      if (
        !hasValidTeacherScope(
          teacherScope
        )
      ) {

        return badRequest(
          res,
          "Teacher class/section assignment is required."
        );

      }


      /* -----------------------------------------------------
         PUBLICATION
      ----------------------------------------------------- */

      const publication =
        resolvePublication(
          req
        );


      if (
        !publication.ok
      ) {

        return badRequest(
          res,
          publication.message
        );

      }


      /* -----------------------------------------------------
         CREATE
      ----------------------------------------------------- */

      const doc =
        await Announcement.create({

          title,

          category,

          /*
            Teacher announcements always target
            their class/section.
          */

          audience:
            "class",

          message,


          className:
            teacherScope.className,

          sectionName:
            teacherScope.sectionName,


          source:
            "teacher",

          authorRole:
            "teacher",


          draft:
            publication.draft,

          publishAt:
            publication.publishAt,

          archived:
            false,


          createdBy:
            teacherId,

          updatedBy:
            teacherId,

        });


      const result =
        doc.toObject({
          virtuals: true,
        });


      result.status =
        getStatus(
          result
        );


      let responseMessage =
        "Announcement published successfully.";


      if (
        result.status ===
        "draft"
      ) {

        responseMessage =
          "Announcement saved as draft.";

      }

      else if (
        result.status ===
        "scheduled"
      ) {

        responseMessage =
          "Announcement scheduled successfully.";

      }


      return res.status(201).json({

        ok: true,

        message:
          responseMessage,

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


/* =========================================================
   GET TEACHER ANNOUNCEMENTS
========================================================= */

exports.getTeacherAnnouncements =
  async (
    req,
    res
  ) => {

    try {

      /* -----------------------------------------------------
         TEACHER ONLY
      ----------------------------------------------------- */

      if (
        !isTeacher(req)
      ) {

        return forbidden(
          res,
          "Only teachers can access teacher announcements."
        );

      }


      const teacherId =
        getUserId(req);


      if (!teacherId) {

        return unauthorized(
          res,
          "Teacher session not found."
        );

      }


      /* -----------------------------------------------------
         GET TEACHER ASSIGNMENT FROM DATABASE
      ----------------------------------------------------- */

      const teacherScope =
        await getTeacherAssignment(
          req
        );


      if (
        !hasValidTeacherScope(
          teacherScope
        )
      ) {

        return badRequest(
          res,
          "Teacher class/section assignment is required."
        );

      }


      const className =
        teacherScope.className;


      const sectionName =
        teacherScope.sectionName;


      /* -----------------------------------------------------
         QUERY PARAMETERS
      ----------------------------------------------------- */

      const {
        search = "",
        type = "all",
        category = "all",
      } = req.query;


      /* -----------------------------------------------------
         VALID STATUS
      ----------------------------------------------------- */

      if (
        !VALID_TYPES.includes(
          type
        )
      ) {

        return badRequest(
          res,
          "Invalid announcement status filter."
        );

      }


      /* -----------------------------------------------------
         CATEGORY
      ----------------------------------------------------- */

      if (
        category !==
        "all"
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


      /* -----------------------------------------------------
         ARCHIVE FILTER
      ----------------------------------------------------- */

      /*
        IMPORTANT:

        When teacher selects:

          archived

        we must actually fetch archived
        documents from MongoDB.

        For all other statuses, archived
        announcements are excluded.
      */

      const archiveFilter =
        type === "archived"
          ? {
              archived: true,
            }
          : {
              archived: false,
            };


      /* -----------------------------------------------------
         BASE QUERY
      ----------------------------------------------------- */

      const query = {

        ...archiveFilter,

        $or: [

          /* -----------------------------------------------
             TEACHER'S OWN CLASS ANNOUNCEMENTS
          ----------------------------------------------- */

          {

            createdBy:
              teacherId,

            source:
              "teacher",

            audience:
              "class",

            className,

            sectionName,

          },


          /* -----------------------------------------------
             ADMIN ANNOUNCEMENTS
          ----------------------------------------------- */

          {
            source:
              "admin",

            /*
              Teachers can only receive Admin
              announcements intended for:

                all
                teachers

              NOT:

                students
            */

            audience: {
              $in: [
                "all",
                "teachers",
              ],
            },

          },

        ],

      };


      /* -----------------------------------------------------
         CATEGORY FILTER
      ----------------------------------------------------- */

      if (
        category !==
        "all"
      ) {

        query.category =
          category;

      }


      /* -----------------------------------------------------
         SEARCH
      ----------------------------------------------------- */

      const searchText =
        normalize(
          search
        );


      if (
        searchText
      ) {

        query.$and = [

          {

            $or: [

              {
                title: {
                  $regex:
                    searchText,

                  $options:
                    "i",
                },
              },

              {
                message: {
                  $regex:
                    searchText,

                  $options:
                    "i",
                },
              },

              {
                location: {
                  $regex:
                    searchText,

                  $options:
                    "i",
                },
              },

            ],

          },

        ];

      }


      /* -----------------------------------------------------
         FETCH
      ----------------------------------------------------- */

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


      /* -----------------------------------------------------
         STATUS
      ----------------------------------------------------- */

      rows =
        rows.map(
          (row) =>
            attachStatus(
              row
            )
        );


      /* -----------------------------------------------------
         TEACHER VISIBILITY
      ----------------------------------------------------- */

      rows =
        rows.filter(
          (row) => {

            const source =
              normalize(
                row.source
              ).toLowerCase();


            const owned =
              isOwnedByTeacher(
                row,
                teacherId
              );


            /* ---------------------------------------------
               OWN TEACHER ANNOUNCEMENTS
            --------------------------------------------- */

            if (
              source === "teacher" &&
              owned
            ) {

              if (
                type === "all"
              ) {

                return true;

              }

              return (
                row.status ===
                type
              );

            }


            /* ---------------------------------------------
               ADMIN ANNOUNCEMENTS
            --------------------------------------------- */

            if (
              source === "admin"
            ) {

              /*
                Admin announcements:

                  all      -> visible
                  teachers -> visible
                  students -> never visible

                Also only published announcements
                are visible to teachers.
              */

              return (
                row.status ===
                "published"
              );

            }


            return false;

          }
        );


      /* -----------------------------------------------------
         RESPONSE
      ----------------------------------------------------- */

      return res.json({

        ok: true,

        data:
          rows,

      });

    } catch (err) {

      return serverError(
        res,
        err
      );

    }

  };


/* =========================================================
   GET ONE TEACHER ANNOUNCEMENT
========================================================= */

exports.getTeacherAnnouncementById =
  async (
    req,
    res
  ) => {

    try {

      if (
        !isTeacher(req)
      ) {

        return forbidden(
          res,
          "Only teachers can access teacher announcements."
        );

      }


      const teacherId =
        getUserId(req);


      if (!teacherId) {

        return unauthorized(
          res,
          "Teacher session not found."
        );

      }


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


      const result =
        attachStatus(
          row
        );


      const source =
        normalize(
          result.source
        ).toLowerCase();


      /* -----------------------------------------------------
         OWN TEACHER ANNOUNCEMENT
      ----------------------------------------------------- */

      if (
        source === "teacher" &&
        isOwnedByTeacher(
          result,
          teacherId
        )
      ) {

        return res.json({

          ok: true,

          data:
            result,

        });

      }


      /* -----------------------------------------------------
         ADMIN ANNOUNCEMENT
      ----------------------------------------------------- */

      const adminAudience =
        normalize(
          result.audience
        ).toLowerCase();


      if (
        source === "admin" &&

        (
          adminAudience === "all" ||
          adminAudience === "teachers"
        ) &&

        result.status ===
          "published"
      ) {

        return res.json({

          ok: true,

          data:
            result,

        });

      }


      /* -----------------------------------------------------
         HIDDEN
      ----------------------------------------------------- */

      return res.status(404).json({

        ok: false,

        message:
          "Announcement not found.",

      });

    } catch (err) {

      return serverError(
        res,
        err
      );

    }

  };


/* =========================================================
   UPDATE TEACHER ANNOUNCEMENT
========================================================= */

exports.updateTeacherAnnouncement =
  async (
    req,
    res
  ) => {

    try {

      if (
        !isTeacher(req)
      ) {

        return forbidden(
          res,
          "Only teachers can update teacher announcements."
        );

      }


      const teacherId =
        getUserId(req);


      if (!teacherId) {

        return unauthorized(
          res,
          "Teacher session not found."
        );

      }


      const row =
        await Announcement.findById(
          req.params.id
        );


      if (!row) {

        return res.status(404).json({

          ok: false,

          message:
            "Announcement not found.",

        });

      }


      /* -----------------------------------------------------
         OWNERSHIP
      ----------------------------------------------------- */

      if (
        !isOwnedByTeacher(
          row,
          teacherId
        )
      ) {

        return forbidden(
          res,
          "You can only edit your own announcements."
        );

      }


      /* -----------------------------------------------------
         ADMIN PROTECTION
      ----------------------------------------------------- */

      if (
        normalize(
          row.source
        ).toLowerCase() ===
        "admin"
      ) {

        return forbidden(
          res,
          "Admin announcements are read-only."
        );

      }


      /* -----------------------------------------------------
         BASIC FIELDS
      ----------------------------------------------------- */

      const title =
        normalize(
          req.body?.title
        );


      const message =
        normalize(
          req.body?.message
        );


      const category =
        normalize(
          req.body?.category ||
          row.category ||
          "general"
        );


      if (!title) {

        return badRequest(
          res,
          "Title is required."
        );

      }


      if (!message) {

        return badRequest(
          res,
          "Message is required."
        );

      }


      if (
        !validateCategory(
          res,
          category
        )
      ) {
        return;
      }


      /* -----------------------------------------------------
         CURRENT TEACHER ASSIGNMENT
      ----------------------------------------------------- */

      const teacherScope =
        await getTeacherAssignment(
          req
        );


      if (
        !hasValidTeacherScope(
          teacherScope
        )
      ) {

        return badRequest(
          res,
          "Teacher class/section assignment is required."
        );

      }


      /* -----------------------------------------------------
         UPDATE
      ----------------------------------------------------- */

      row.title =
        title;


      row.category =
        category;


      row.message =
        message;


      row.source =
        "teacher";


      row.audience =
        "class";


      row.className =
        teacherScope.className;


      row.sectionName =
        teacherScope.sectionName;


      /* -----------------------------------------------------
         PUBLICATION
      ----------------------------------------------------- */

      const publication =
        resolvePublication(
          req
        );


      if (
        !publication.ok
      ) {

        return badRequest(
          res,
          publication.message
        );

      }


      row.draft =
        publication.draft;


      row.publishAt =
        publication.publishAt;


      row.archived =
        false;


      row.updatedBy =
        teacherId;


      /* -----------------------------------------------------
         SAVE
      ----------------------------------------------------- */

      await row.save();


      const result =
        row.toObject({
          virtuals: true,
        });


      result.status =
        getStatus(
          result
        );


      let responseMessage =
        "Announcement updated successfully.";


      if (
        result.status ===
        "draft"
      ) {

        responseMessage =
          "Announcement draft saved successfully.";

      }

      else if (
        result.status ===
        "scheduled"
      ) {

        responseMessage =
          "Announcement scheduled successfully.";

      }

      else if (
        result.status ===
        "published"
      ) {

        responseMessage =
          "Announcement published successfully.";

      }


      return res.json({

        ok: true,

        message:
          responseMessage,

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


/* =========================================================
   ARCHIVE / UNARCHIVE
========================================================= */

exports.toggleTeacherArchiveAnnouncement =
  async (
    req,
    res
  ) => {

    try {

      if (
        !isTeacher(req)
      ) {

        return forbidden(
          res,
          "Only teachers can archive announcements."
        );

      }


      const teacherId =
        getUserId(req);


      if (!teacherId) {

        return unauthorized(
          res,
          "Teacher session not found."
        );

      }


      const row =
        await Announcement.findById(
          req.params.id
        );


      if (!row) {

        return res.status(404).json({

          ok: false,

          message:
            "Announcement not found.",

        });

      }


      /* -----------------------------------------------------
         OWNERSHIP
      ----------------------------------------------------- */

      if (
        !isOwnedByTeacher(
          row,
          teacherId
        )
      ) {

        return forbidden(
          res,
          "You can only archive your own announcements."
        );

      }


      /* -----------------------------------------------------
         ADMIN PROTECTION
      ----------------------------------------------------- */

      if (
        normalize(
          row.source
        ).toLowerCase() ===
        "admin"
      ) {

        return forbidden(
          res,
          "Admin announcements are read-only."
        );

      }


      /* -----------------------------------------------------
         TOGGLE
      ----------------------------------------------------- */

      row.archived =
        !row.archived;


      row.updatedBy =
        teacherId;


      await row.save();


      const result =
        row.toObject({
          virtuals: true,
        });


      result.status =
        getStatus(
          result
        );


      return res.json({

        ok: true,

        message:
          result.status ===
          "archived"

            ? "Announcement archived successfully."

            : "Announcement unarchived successfully.",

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


/* =========================================================
   DELETE
========================================================= */

exports.deleteTeacherAnnouncement =
  async (
    req,
    res
  ) => {

    try {

      if (
        !isTeacher(req)
      ) {

        return forbidden(
          res,
          "Only teachers can delete announcements."
        );

      }


      const teacherId =
        getUserId(req);


      if (!teacherId) {

        return unauthorized(
          res,
          "Teacher session not found."
        );

      }


      const row =
        await Announcement.findById(
          req.params.id
        );


      if (!row) {

        return res.status(404).json({

          ok: false,

          message:
            "Announcement not found.",

        });

      }


      /* -----------------------------------------------------
         OWNERSHIP
      ----------------------------------------------------- */

      if (
        !isOwnedByTeacher(
          row,
          teacherId
        )
      ) {

        return forbidden(
          res,
          "You can only delete your own announcements."
        );

      }


      /* -----------------------------------------------------
         ADMIN PROTECTION
      ----------------------------------------------------- */

      if (
        normalize(
          row.source
        ).toLowerCase() ===
        "admin"
      ) {

        return forbidden(
          res,
          "Admin announcements are read-only."
        );

      }


      /* -----------------------------------------------------
         DELETE
      ----------------------------------------------------- */

      await Announcement.findByIdAndDelete(
        req.params.id
      );


      return res.json({

        ok: true,

        message:
          "Announcement deleted successfully.",

      });

    } catch (err) {

      return serverError(
        res,
        err
      );

    }

  };