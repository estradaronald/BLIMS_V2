const mongoose = require("mongoose");


/* =========================================================
   ANNOUNCEMENT FILE
========================================================= */

const AnnouncementFileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },

    url: {
      type: String,
      trim: true,
      default: "",
    },

    mimeType: {
      type: String,
      trim: true,
      default: "",
    },

    size: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);


/* =========================================================
   ANNOUNCEMENT
========================================================= */

const AnnouncementSchema = new mongoose.Schema(
  {
    /* -------------------------------------------------------
       BASIC INFORMATION
    ------------------------------------------------------- */

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    category: {
      type: String,
      enum: [
        "general",
        "events",
        "academic",
        "priority",
      ],
      default: "general",
    },

    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },


    /* -------------------------------------------------------
       SOURCE / AUTHOR ROLE
       
       source:
         admin   = created by administrator
         teacher = created by teacher

       authorRole:
         admin
         teacher

       These fields allow the system to distinguish
       Admin announcements from Teacher announcements.
    ------------------------------------------------------- */

    source: {
      type: String,
      enum: [
        "admin",
        "teacher",
      ],
      default: "admin",
    },

    authorRole: {
      type: String,
      enum: [
        "admin",
        "teacher",
      ],
      default: "admin",
    },


    /* -------------------------------------------------------
       AUDIENCE

       ADMIN:

       all      = Students & Teachers
       students = Students Only
       teachers = Teachers Only

       TEACHER:

       class    = Teacher's handled class/section

       Audience applies to all announcement categories.
    ------------------------------------------------------- */

    audience: {
      type: String,
      enum: [
        "all",
        "students",
        "teachers",
        "class",
      ],
      default: "all",
    },


    /* -------------------------------------------------------
       TEACHER CLASS / SECTION TARGET

       Used when:

         audience === "class"

       Example:

         audience: "class"
         className: "Kindergarten"
         sectionName: "Everlasting"

       Admin announcements can leave these fields empty.
    ------------------------------------------------------- */

    className: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    sectionName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },


    /* -------------------------------------------------------
       EVENT INFORMATION

       Used when:
         category === "events"

       These fields remain available because the same model
       is also used by Admin announcements.
    ------------------------------------------------------- */

    eventType: {
      type: String,
      enum: [
        "school",
        "holiday",
        "exam",
        "meeting",
        "other",
      ],
      default: null,
    },

    start: {
      type: Date,
      default: null,
    },

    end: {
      type: Date,
      default: null,
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    image: {
      name: {
        type: String,
        default: "",
      },

      dataUrl: {
        type: String,
        default: "",
      },
    },


    /* -------------------------------------------------------
       PUBLICATION
    ------------------------------------------------------- */

    publishAt: {
      type: Date,
      default: null,
    },

    draft: {
      type: Boolean,
      default: false,
    },

    archived: {
      type: Boolean,
      default: false,
    },


    /* -------------------------------------------------------
       ATTACHMENTS
    ------------------------------------------------------- */

    files: {
      type: [AnnouncementFileSchema],
      default: [],
    },


    /* -------------------------------------------------------
       USERS
    ------------------------------------------------------- */

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
  },

  {
    timestamps: true,
  }
);


/* =========================================================
   STATUS
========================================================= */

AnnouncementSchema.virtual("status").get(function () {

  if (
    this.archived
  ) {

    return "archived";

  }


  if (
    this.draft
  ) {

    return "draft";

  }


  if (
    this.publishAt &&
    this.publishAt.getTime() >
      Date.now()
  ) {

    return "scheduled";

  }


  return "published";

});


/* =========================================================
   JSON / OBJECT VIRTUALS
========================================================= */

AnnouncementSchema.set(
  "toJSON",
  {
    virtuals: true,
  }
);


AnnouncementSchema.set(
  "toObject",
  {
    virtuals: true,
  }
);


/* =========================================================
   MODEL
========================================================= */

module.exports =
  mongoose.model(
    "Announcement",
    AnnouncementSchema
  );