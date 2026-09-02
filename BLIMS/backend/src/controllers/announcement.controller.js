const Announcement = require("../models/Announcement.model");


/* =========================================================
   CONSTANTS
========================================================= */

const VALID_CATEGORIES = [
  "general",
  "events",
  "academic",
  "priority",
];

const VALID_AUDIENCES = [
  "all",
  "teachers",
  "students",
];

const VALID_EVENT_TYPES = [
  "school",
  "holiday",
  "exam",
  "meeting",
  "other",
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


function serverError(
  res,
  err,
  message = "Server error."
) {
  console.error(
    "Announcement controller error:",
    err
  );

  return res.status(500).json({
    ok: false,
    message,
  });
}


function normalizeFiles(files = []) {
  return files.map((file) => ({
    name:
      file.originalname ||
      file.name ||
      "",

    url:
      file.path ||
      file.url ||
      "",

    mimeType:
      file.mimetype ||
      file.mimeType ||
      "",

    size:
      file.size ||
      0,
  }));
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
   STATUS
========================================================= */

function getStatus(row) {

  if (row.archived) {
    return "archived";
  }


  if (row.draft) {
    return "draft";
  }


  if (
    row.publishAt &&
    new Date(row.publishAt).getTime() >
      Date.now()
  ) {
    return "scheduled";
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
   CURRENT USER ROLE
========================================================= */

function getUserRole(req) {

  return String(
    req.session?.user?.role || ""
  )
    .trim()
    .toLowerCase();

}


function isTeacherRole(req) {

  const role =
    getUserRole(req);

  return (
    role === "teacher" ||
    role === "faculty"
  );

}


function isStudentRole(req) {

  return (
    getUserRole(req) ===
    "student"
  );

}


/* =========================================================
   CREATE ADMIN ANNOUNCEMENT
========================================================= */

exports.createAnnouncement = async (
  req,
  res
) => {

  try {

    const {
      title,
      category = "general",
      audience = "all",
      message,

      // Optional event information
      eventType,
      start,
      end,
      location = "",
      image = null,

      // Publishing
      publishAt,
      draft = false,
    } = req.body;


    /* -------------------------------------------------------
       BASIC VALIDATION
    ------------------------------------------------------- */

    const cleanTitle =
      String(
        title || ""
      ).trim();


    const cleanMessage =
      String(
        message || ""
      ).trim();


    if (!cleanTitle) {

      return badRequest(
        res,
        "Title is required."
      );

    }


    if (!cleanMessage) {

      return badRequest(
        res,
        "Message is required."
      );

    }


    /* -------------------------------------------------------
       CATEGORY
    ------------------------------------------------------- */

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


    /* -------------------------------------------------------
       AUDIENCE
       
       all       = Students & Teachers
       students  = Students Only
       teachers  = Teachers Only
    ------------------------------------------------------- */

    if (
      !VALID_AUDIENCES.includes(
        audience
      )
    ) {

      return badRequest(
        res,
        "Invalid announcement audience."
      );

    }


    /* -------------------------------------------------------
       EVENT INFORMATION
    ------------------------------------------------------- */

    let cleanEventType =
      null;


    let cleanStart =
      null;


    let cleanEnd =
      null;


    let cleanLocation =
      "";


    let cleanImage = {
      name: "",
      dataUrl: "",
    };


    if (
      category === "events"
    ) {

      /* Event type */

      if (
        eventType &&
        !VALID_EVENT_TYPES.includes(
          eventType
        )
      ) {

        return badRequest(
          res,
          "Invalid event type."
        );

      }


      cleanEventType =
        eventType ||
        "school";


      /* Event start */

      if (start) {

        cleanStart =
          parseDate(start);


        if (!cleanStart) {

          return badRequest(
            res,
            "Invalid event start date."
          );

        }

      }


      /* Event end */

      if (end) {

        cleanEnd =
          parseDate(end);


        if (!cleanEnd) {

          return badRequest(
            res,
            "Invalid event end date."
          );

        }


        if (
          cleanStart &&
          cleanEnd < cleanStart
        ) {

          return badRequest(
            res,
            "Event end date cannot be before the start date."
          );

        }

      }


      cleanLocation =
        String(
          location || ""
        ).trim();


      if (image) {

        cleanImage =
          image;

      }

    }


    /* -------------------------------------------------------
       PUBLICATION
       
       Publish Now:
         draft = false
         publishAt = null
       
       Schedule Later:
         draft = false
         publishAt = future date
       
       Save as Draft:
         draft = true
         publishAt = null
    ------------------------------------------------------- */

    const isDraft =
      toBoolean(draft);


    let cleanPublishAt =
      null;


    if (
      publishAt !== null &&
      publishAt !== undefined &&
      publishAt !== ""
    ) {

      cleanPublishAt =
        parseDate(
          publishAt
        );


      if (!cleanPublishAt) {

        return badRequest(
          res,
          "Invalid publish date."
        );

      }


      if (
        !isDraft &&
        cleanPublishAt.getTime() <=
          Date.now()
      ) {

        return badRequest(
          res,
          "Scheduled publication date must be in the future."
        );

      }

    }


    /*
     * Drafts should never have
     * a publication date.
     */

    if (isDraft) {

      cleanPublishAt =
        null;

    }


    /* -------------------------------------------------------
       FILES
    ------------------------------------------------------- */

    const files =
      normalizeFiles(
        req.files || []
      );


    /* -------------------------------------------------------
       CREATE DOCUMENT
    ------------------------------------------------------- */

    const doc =
      await Announcement.create({

        /* Basic information */

        title:
          cleanTitle,

        category,

        audience,

        message:
          cleanMessage,


        /* -----------------------------------------------------
           SOURCE

           This announcement is created by Admin.

           IMPORTANT:
           Teacher controller uses source === "admin"
           to identify Admin announcements.
        ----------------------------------------------------- */

        source:
          "admin",

        authorRole:
          "admin",


        /* Event information */

        eventType:
          category === "events"
            ? cleanEventType
            : null,

        start:
          category === "events"
            ? cleanStart
            : null,

        end:
          category === "events"
            ? cleanEnd
            : null,

        location:
          category === "events"
            ? cleanLocation
            : "",

        image:
          category === "events"
            ? cleanImage
            : {
                name: "",
                dataUrl: "",
              },


        /* Publishing */

        publishAt:
          cleanPublishAt,

        draft:
          isDraft,

        archived:
          false,


        /* Attachments */

        files,


        /* Users */

        createdBy:
          req.session?.user?.id ||
          null,

        updatedBy:
          req.session?.user?.id ||
          null,
      });


    const result =
      doc.toObject({
        virtuals: true,
      });


    result.status =
      getStatus(result);


    /* -------------------------------------------------------
       RESPONSE MESSAGE
    ------------------------------------------------------- */

    let responseMessage =
      "Announcement published successfully.";


    if (isDraft) {

      responseMessage =
        "Announcement saved as draft.";

    }

    else if (
      cleanPublishAt &&
      cleanPublishAt.getTime() >
        Date.now()
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
   GET ALL ANNOUNCEMENTS
========================================================= */

exports.getAllAnnouncements = async (
  req,
  res
) => {

  try {

    const {
      search = "",
      type = "all",
      category = "all",
      audience = "all",
    } = req.query;


    const query = {};


    /* =======================================================
       ROLE-BASED VISIBILITY

       ADMIN:
         Can see everything.

       TEACHER / FACULTY:
         ONLY published announcements.
         ONLY audience:
           - all
           - teachers

       STUDENT:
         ONLY published announcements.
         ONLY audience:
           - all
           - students
    ======================================================= */

    const teacher =
      isTeacherRole(req);


    const student =
      isStudentRole(req);


    /* -------------------------------------------------------
       TEACHER / FACULTY
    ------------------------------------------------------- */

    if (teacher) {

      query.archived =
        false;


      query.draft =
        false;


      /*
       * Published means:
       *
       * publishAt is null
       * OR publishAt has already arrived.
       */

      query.$or = [

        {
          publishAt:
            null,
        },

        {
          publishAt: {
            $lte:
              new Date(),
          },
        },

      ];


      /*
       * Teachers can only see:
       *
       * all
       * teachers
       */

      query.audience = {
        $in: [
          "all",
          "teachers",
        ],
      };

    }


    /* -------------------------------------------------------
       STUDENTS
    ------------------------------------------------------- */

    else if (student) {

      query.archived =
        false;


      query.draft =
        false;


      query.$or = [

        {
          publishAt:
            null,
        },

        {
          publishAt: {
            $lte:
              new Date(),
          },
        },

      ];


      /*
       * Students can only see:
       *
       * all
       * students
       */

      query.audience = {
        $in: [
          "all",
          "students",
        ],
      };

    }


    /* =======================================================
       CATEGORY FILTER
    ======================================================= */

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


      query.category =
        category;

    }


    /* =======================================================
       AUDIENCE FILTER

       This filter can ONLY narrow results.
       It cannot bypass role-based visibility.
    ======================================================= */

    if (
      audience !== "all"
    ) {

      if (
        !VALID_AUDIENCES.includes(
          audience
        )
      ) {

        return badRequest(
          res,
          "Invalid announcement audience."
        );

      }


      /* -----------------------------------------------------
         Teacher cannot request student announcements.
      ----------------------------------------------------- */

      if (
        teacher &&
        audience === "students"
      ) {

        return res.json({
          ok: true,
          data: [],
        });

      }


      /* -----------------------------------------------------
         Student cannot request teacher announcements.
      ----------------------------------------------------- */

      if (
        student &&
        audience === "teachers"
      ) {

        return res.json({
          ok: true,
          data: [],
        });

      }


      query.audience =
        audience;

    }


    /* =======================================================
       SEARCH
    ======================================================= */

    const searchText =
      String(
        search
      ).trim();


    if (searchText) {

      /*
       * Use $and so the role-based
       * publication $or remains intact.
       */

      query.$and = [

        ...(query.$and || []),

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


    /* =======================================================
       FETCH
    ======================================================= */

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


    /* =======================================================
       ATTACH STATUS
    ======================================================= */

    rows =
      rows.map(
        (row) =>
          attachStatus(row)
      );


    /* =======================================================
       STATUS FILTER
    ======================================================= */

    const validTypes = [
      "all",
      "published",
      "scheduled",
      "draft",
      "archived",
    ];


    if (
      !validTypes.includes(
        type
      )
    ) {

      return badRequest(
        res,
        "Invalid announcement status filter."
      );

    }


    /*
     * Teacher and Student endpoints
     * are always restricted to published
     * announcements by the query above.
     */

    if (
      teacher ||
      student
    ) {

      rows =
        rows.filter(
          (row) =>
            row.status ===
            "published"
        );

    }

    else if (
      type !== "all"
    ) {

      rows =
        rows.filter(
          (row) =>
            row.status ===
            type
        );

    }


    /* =======================================================
       RESPONSE
    ======================================================= */

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
   GET ONE ANNOUNCEMENT
========================================================= */

exports.getAnnouncementById = async (
  req,
  res
) => {

  try {

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


    /* -------------------------------------------------------
       NOT FOUND
    ------------------------------------------------------- */

    if (!row) {

      return res.status(404).json({

        ok: false,

        message:
          "Announcement not found.",

      });

    }


    /* -------------------------------------------------------
       ATTACH STATUS
    ------------------------------------------------------- */

    const result =
      attachStatus(row);


    /* -------------------------------------------------------
       TEACHER / FACULTY VISIBILITY

       Teacher can ONLY access:
         published
         audience = all OR teachers
    ------------------------------------------------------- */

    if (
      isTeacherRole(req)
    ) {

      const allowedAudience =
        result.audience === "all" ||
        result.audience === "teachers";


      if (
        result.status !==
          "published" ||
        !allowedAudience
      ) {

        return res.status(404).json({

          ok: false,

          message:
            "Announcement not found.",

        });

      }

    }


    /* -------------------------------------------------------
       STUDENT VISIBILITY

       Student can ONLY access:
         published
         audience = all OR students
    ------------------------------------------------------- */

    if (
      isStudentRole(req)
    ) {

      const allowedAudience =
        result.audience === "all" ||
        result.audience === "students";


      if (
        result.status !==
          "published" ||
        !allowedAudience
      ) {

        return res.status(404).json({

          ok: false,

          message:
            "Announcement not found.",

        });

      }

    }


    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

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


/* =========================================================
   UPDATE ANNOUNCEMENT
========================================================= */

exports.updateAnnouncement = async (
  req,
  res
) => {

  try {

    const {
      title,
      category,
      audience,
      message,

      // Optional event information
      eventType,
      start,
      end,
      location,
      image,

      // Publishing
      publishAt,
      draft,
      archived,
    } = req.body;


    /* -------------------------------------------------------
       FIND
    ------------------------------------------------------- */

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


    /* -------------------------------------------------------
       BASIC VALIDATION
    ------------------------------------------------------- */

    const cleanTitle =
      String(
        title || ""
      ).trim();


    const cleanMessage =
      String(
        message || ""
      ).trim();


    if (!cleanTitle) {

      return badRequest(
        res,
        "Title is required."
      );

    }


    if (!cleanMessage) {

      return badRequest(
        res,
        "Message is required."
      );

    }


    /* -------------------------------------------------------
       CATEGORY
    ------------------------------------------------------- */

    const finalCategory =
      category ||
      row.category ||
      "general";


    if (
      !VALID_CATEGORIES.includes(
        finalCategory
      )
    ) {

      return badRequest(
        res,
        "Invalid announcement category."
      );

    }


    /* -------------------------------------------------------
       AUDIENCE
    ------------------------------------------------------- */

    const finalAudience =
      audience ||
      row.audience ||
      "all";


    if (
      !VALID_AUDIENCES.includes(
        finalAudience
      )
    ) {

      return badRequest(
        res,
        "Invalid announcement audience."
      );

    }


    /* -------------------------------------------------------
       BASIC FIELDS
    ------------------------------------------------------- */

    row.title =
      cleanTitle;


    row.category =
      finalCategory;


    row.audience =
      finalAudience;


    row.message =
      cleanMessage;


    /* -------------------------------------------------------
       SOURCE

       This controller is the Admin controller.

       Existing or updated announcements handled here
       must remain Admin announcements.
    ------------------------------------------------------- */

    row.source =
      "admin";

    row.authorRole =
      "admin";


    /* -------------------------------------------------------
       EVENT INFORMATION
    ------------------------------------------------------- */

    if (
      finalCategory ===
      "events"
    ) {

      if (
        eventType &&
        !VALID_EVENT_TYPES.includes(
          eventType
        )
      ) {

        return badRequest(
          res,
          "Invalid event type."
        );

      }


      row.eventType =
        eventType ||
        row.eventType ||
        "school";


      /* -----------------------------------------------------
         START
      ----------------------------------------------------- */

      if (
        start !==
        undefined
      ) {

        if (
          start === null ||
          start === ""
        ) {

          row.start =
            null;

        }

        else {

          const parsedStart =
            parseDate(start);


          if (!parsedStart) {

            return badRequest(
              res,
              "Invalid event start date."
            );

          }


          row.start =
            parsedStart;

        }

      }


      /* -----------------------------------------------------
         END
      ----------------------------------------------------- */

      if (
        end !==
        undefined
      ) {

        if (
          end === null ||
          end === ""
        ) {

          row.end =
            null;

        }

        else {

          const parsedEnd =
            parseDate(end);


          if (!parsedEnd) {

            return badRequest(
              res,
              "Invalid event end date."
            );

          }


          if (
            row.start &&
            parsedEnd <
              row.start
          ) {

            return badRequest(
              res,
              "Event end date cannot be before the start date."
            );

          }


          row.end =
            parsedEnd;

        }

      }


      /* -----------------------------------------------------
         LOCATION
      ----------------------------------------------------- */

      if (
        location !==
        undefined
      ) {

        row.location =
          String(
            location || ""
          ).trim();

      }


      /* -----------------------------------------------------
         IMAGE
      ----------------------------------------------------- */

      if (
        image !==
        undefined
      ) {

        row.image =
          image || {
            name: "",
            dataUrl: "",
          };

      }

    }

    else {

      /*
       * Clear event-specific fields
       * when changing category.
       */

      row.eventType =
        null;


      row.start =
        null;


      row.end =
        null;


      row.location =
        "";


      row.image = {

        name: "",

        dataUrl: "",

      };

    }


    /* =======================================================
       PUBLISHING
    ======================================================= */

    let finalDraft =
      row.draft;


    if (
      draft !==
      undefined
    ) {

      finalDraft =
        toBoolean(
          draft
        );

    }


    row.draft =
      finalDraft;


    /* -------------------------------------------------------
       PUBLISH DATE
    ------------------------------------------------------- */

    if (
      publishAt !==
      undefined
    ) {

      if (
        publishAt ===
          null ||
        publishAt ===
          ""
      ) {

        row.publishAt =
          null;

      }

      else {

        const parsedPublishAt =
          parseDate(
            publishAt
          );


        if (
          !parsedPublishAt
        ) {

          return badRequest(
            res,
            "Invalid publish date."
          );

        }


        if (
          !finalDraft &&
          parsedPublishAt.getTime() <=
            Date.now()
        ) {

          return badRequest(
            res,
            "Scheduled publication date must be in the future."
          );

        }


        row.publishAt =
          parsedPublishAt;

      }

    }


    /*
     * Drafts never keep a
     * publication date.
     */

    if (
      finalDraft
    ) {

      row.publishAt =
        null;

    }


    /* =======================================================
       ARCHIVE
    ======================================================= */

    if (
      archived !==
      undefined
    ) {

      row.archived =
        toBoolean(
          archived
        );

    }


    /* =======================================================
       UPDATED BY
    ======================================================= */

    row.updatedBy =
      req.session?.user?.id ||
      null;


    /* =======================================================
       FILES
    ======================================================= */

    if (
      req.files?.length
    ) {

      row.files =
        normalizeFiles(
          req.files
        );

    }


    /* =======================================================
       SAVE
    ======================================================= */

    await row.save();


    const result =
      row.toObject({
        virtuals: true,
      });


    result.status =
      getStatus(result);


    /* =======================================================
       RESPONSE MESSAGE
    ======================================================= */

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

exports.toggleArchiveAnnouncement =
  async (
    req,
    res
  ) => {

    try {

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


      row.archived =
        !row.archived;


      row.updatedBy =
        req.session?.user?.id ||
        null;


      await row.save();


      const result =
        row.toObject({
          virtuals: true,
        });


      result.status =
        getStatus(result);


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

exports.deleteAnnouncement =
  async (
    req,
    res
  ) => {

    try {

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