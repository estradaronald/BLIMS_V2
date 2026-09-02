const SchoolYear = require("../models/SchoolYear.model");


/* =========================================================
   CONSTANTS
========================================================= */

const MIN_TERMS = 1;
const MAX_TERMS = 4;
const DEFAULT_TERMS = 3;


/* =========================================================
   DEFAULT TERMS
========================================================= */

function makeDefaultTerms(
  numberOfTerms = DEFAULT_TERMS
) {
  return Array.from(
    { length: numberOfTerms },
    (_, index) => ({
      order: index + 1,
      name: `Term ${index + 1}`,
      start: null,
      end: null,
      locked: false,
    })
  );
}


/* =========================================================
   GET ALL SCHOOL YEARS
========================================================= */

exports.getSchoolYears = async (
  req,
  res,
  next
) => {
  try {
    const items =
      await SchoolYear
        .find()
        .sort({
          createdAt: -1,
        });


    res.status(200).json({
      success: true,
      items,
    });

  } catch (error) {
    next(error);
  }
};


/* =========================================================
   CREATE SCHOOL YEAR
========================================================= */

exports.createSchoolYear = async (
  req,
  res,
  next
) => {
  try {

    const {
      name,
      start,
      end,
      numberOfTerms = DEFAULT_TERMS,
    } = req.body;


    /* -----------------------------------------------------
       VALIDATE NAME
    ----------------------------------------------------- */

    if (
      !name ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message:
          "School year name is required.",
      });
    }


    /* -----------------------------------------------------
       VALIDATE NUMBER OF TERMS
    ----------------------------------------------------- */

    if (
      !Number.isInteger(
        numberOfTerms
      ) ||
      numberOfTerms <
        MIN_TERMS ||
      numberOfTerms >
        MAX_TERMS
    ) {
      return res.status(400).json({
        success: false,
        message:
          `Number of terms must be between ${MIN_TERMS} and ${MAX_TERMS}.`,
      });
    }


    /* -----------------------------------------------------
       VALIDATE START DATE
    ----------------------------------------------------- */

    if (start) {

      const startDate =
        new Date(start);

      if (
        Number.isNaN(
          startDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid school year start date.",
        });
      }
    }


    /* -----------------------------------------------------
       VALIDATE END DATE
    ----------------------------------------------------- */

    if (end) {

      const endDate =
        new Date(end);

      if (
        Number.isNaN(
          endDate.getTime()
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid school year end date.",
        });
      }
    }


    /* -----------------------------------------------------
       VALIDATE SCHOOL YEAR DATE ORDER
    ----------------------------------------------------- */

    if (
      start &&
      end &&
      new Date(start) >
        new Date(end)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "End date must be after start date.",
      });
    }


    /* -----------------------------------------------------
       CHECK DUPLICATE SCHOOL YEAR NAME
    ----------------------------------------------------- */

    const existing =
      await SchoolYear.findOne({
        name: name.trim(),
      });


    if (existing) {
      return res.status(409).json({
        success: false,
        message:
          "That school year already exists.",
      });
    }


    /* =====================================================
       SCHOOL YEAR TIMELINE VALIDATION
    ===================================================== */

    const existingSchoolYears =
      await SchoolYear
        .find()
        .sort({
          end: -1,
        });


    /* -----------------------------------------------------
       IF SCHOOL YEARS ALREADY EXIST
    ----------------------------------------------------- */

    if (
      existingSchoolYears.length >
      0
    ) {

      /* ---------------------------------------------------
         NEW SCHOOL YEAR MUST HAVE A START DATE
      --------------------------------------------------- */

      if (!start) {
        return res.status(400).json({
          success: false,
          message:
            "Start date is required when other school years already exist.",
        });
      }


      /* ---------------------------------------------------
         FIND SCHOOL YEARS WITHOUT END DATE
      --------------------------------------------------- */

      const unfinishedSchoolYear =
        existingSchoolYears.find(
          (schoolYear) =>
            !schoolYear.end
        );


      if (
        unfinishedSchoolYear
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Cannot create a new school year while "${unfinishedSchoolYear.name}" has no end date. Please complete its end date first.`,
        });
      }


      /* ---------------------------------------------------
         FIND LATEST SCHOOL YEAR END DATE
      --------------------------------------------------- */

      const latestEndDate =
        existingSchoolYears.reduce(
          (latest, schoolYear) => {

            const currentEnd =
              new Date(
                schoolYear.end
              );

            if (
              !latest ||
              currentEnd > latest
            ) {
              return currentEnd;
            }

            return latest;
          },

          null
        );


      /* ---------------------------------------------------
         NEW START MUST BE AFTER
         THE LATEST EXISTING END
      --------------------------------------------------- */

      if (
        latestEndDate &&
        new Date(start) <=
          latestEndDate
      ) {

        const latestSchoolYear =
          existingSchoolYears
            .slice()
            .sort(
              (a, b) =>
                new Date(b.end) -
                new Date(a.end)
            )[0];


        return res.status(400).json({
          success: false,
          message:
            `The new school year must start after "${latestSchoolYear.name}" ends on ${latestSchoolYear.end.toISOString().slice(0, 10)}.`,
        });
      }

    }


    /* =====================================================
       ACTIVE SCHOOL YEAR
    ===================================================== */

    const hasActive =
      await SchoolYear.findOne({
        isActive: true,
      });


    /* =====================================================
       CREATE SCHOOL YEAR
    ===================================================== */

    const newSchoolYear =
      await SchoolYear.create({

        name:
          name.trim(),

        start:
          start || null,

        end:
          end || null,

        /*
         * First school year becomes
         * active automatically.
         *
         * Later school years remain
         * inactive until explicitly
         * selected as active.
         */

        isActive:
          !hasActive,

        terms:
          makeDefaultTerms(
            numberOfTerms
          ),

      });


    res.status(201).json({
      success: true,
      message:
        "School year created successfully.",
      item:
        newSchoolYear,
    });

  } catch (error) {
    next(error);
  }
};


/* =========================================================
   SET ACTIVE SCHOOL YEAR
========================================================= */

exports.setActiveSchoolYear = async (
  req,
  res,
  next
) => {
  try {

    const {
      id,
    } = req.params;


    const target =
      await SchoolYear.findById(
        id
      );


    if (!target) {
      return res.status(404).json({
        success: false,
        message:
          "School year not found.",
      });
    }


    /* -----------------------------------------------------
       DEACTIVATE ALL SCHOOL YEARS
    ----------------------------------------------------- */

    await SchoolYear.updateMany(
      {},
      {
        $set: {
          isActive: false,
        },
      }
    );


    /* -----------------------------------------------------
       ACTIVATE TARGET
    ----------------------------------------------------- */

    target.isActive =
      true;


    await target.save();


    res.status(200).json({
      success: true,
      message:
        "School year set as active.",
      item:
        target,
    });

  } catch (error) {
    next(error);
  }
};


/* =========================================================
   UPDATE TERMS
========================================================= */

exports.updateTerms = async (
  req,
  res,
  next
) => {
  try {

    const {
      id,
    } = req.params;


    const {
      terms,
    } = req.body;


    /* -----------------------------------------------------
       VALIDATE ARRAY
    ----------------------------------------------------- */

    if (
      !Array.isArray(
        terms
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Terms must be an array.",
      });
    }


    /* -----------------------------------------------------
       VALIDATE NUMBER OF TERMS
    ----------------------------------------------------- */

    if (
      terms.length <
        MIN_TERMS ||
      terms.length >
        MAX_TERMS
    ) {
      return res.status(400).json({
        success: false,
        message:
          `A school year must have between ${MIN_TERMS} and ${MAX_TERMS} terms.`,
      });
    }


    /* -----------------------------------------------------
       FIND SCHOOL YEAR
    ----------------------------------------------------- */

    const schoolYear =
      await SchoolYear.findById(
        id
      );


    if (!schoolYear) {
      return res.status(404).json({
        success: false,
        message:
          "School year not found.",
      });
    }


    /* -----------------------------------------------------
       VALIDATE EACH TERM
    ----------------------------------------------------- */

    for (
      let i = 0;
      i < terms.length;
      i++
    ) {

      const term =
        terms[i];


      const termName =
        (
          term.name ||
          `Term ${i + 1}`
        ).trim();


      /* ---------------------------------------------------
         VALIDATE TERM DATES
      --------------------------------------------------- */

      if (
        term.start &&
        term.end &&
        new Date(term.start) >
          new Date(term.end)
      ) {
        return res.status(400).json({
          success: false,
          message:
            `End date must be after start date for "${termName}".`,
        });
      }


      /* ---------------------------------------------------
         TERM START MUST BE INSIDE SCHOOL YEAR
      --------------------------------------------------- */

      if (
        term.start &&
        schoolYear.start &&
        new Date(term.start) <
          new Date(
            schoolYear.start
          )
      ) {
        return res.status(400).json({
          success: false,
          message:
            `"${termName}" cannot start before the school year starts.`,
        });
      }


      /* ---------------------------------------------------
         TERM END MUST BE INSIDE SCHOOL YEAR
      --------------------------------------------------- */

      if (
        term.end &&
        schoolYear.end &&
        new Date(term.end) >
          new Date(
            schoolYear.end
          )
      ) {
        return res.status(400).json({
          success: false,
          message:
            `"${termName}" cannot end after the school year ends.`,
        });
      }

    }


    /* -----------------------------------------------------
       VALIDATE TERM ORDER
    ----------------------------------------------------- */

    for (
      let i = 0;
      i < terms.length - 1;
      i++
    ) {

      const current =
        terms[i];

      const next =
        terms[i + 1];


      if (
        current.end &&
        next.start &&
        new Date(current.end) >
          new Date(next.start)
      ) {

        return res.status(400).json({
          success: false,
          message:
            `${current.name || `Term ${i + 1}`} must end before ${next.name || `Term ${i + 2}`} starts.`,
        });

      }

    }


    /* -----------------------------------------------------
       UPDATE TERMS
    ----------------------------------------------------- */

    schoolYear.terms =
      terms.map(
        (
          term,
          index
        ) => ({

          order:
            index + 1,

          name:
            (
              term.name ||
              `Term ${index + 1}`
            ).trim(),

          start:
            term.start ||
            null,

          end:
            term.end ||
            null,

          locked:
            !!term.locked,

        })
      );


    await schoolYear.save();


    res.status(200).json({
      success: true,
      message:
        "Terms updated successfully.",
      item:
        schoolYear,
    });

  } catch (error) {
    next(error);
  }
};


/* =========================================================
   GET ACTIVE SCHOOL YEAR
========================================================= */

exports.getActiveSchoolYear = async (
  req,
  res,
  next
) => {
  try {

    const item =
      await SchoolYear.findOne({
        isActive: true,
      });


    res.status(200).json({
      success: true,
      item,
    });

  } catch (error) {
    next(error);
  }
};


/* =========================================================
   DELETE SCHOOL YEAR
========================================================= */

exports.deleteSchoolYear = async (
  req,
  res,
  next
) => {
  try {

    const {
      id,
    } = req.params;


    const schoolYear =
      await SchoolYear.findById(
        id
      );


    if (!schoolYear) {
      return res.status(404).json({
        success: false,
        message:
          "School year not found.",
      });
    }


    const wasActive =
      !!schoolYear.isActive;


    await SchoolYear.findByIdAndDelete(
      id
    );


    /* -----------------------------------------------------
       SELECT NEXT ACTIVE SCHOOL YEAR
    ----------------------------------------------------- */

    if (wasActive) {

      const nextSchoolYear =
        await SchoolYear
          .findOne()
          .sort({
            createdAt: -1,
          });


      if (
        nextSchoolYear
      ) {

        await SchoolYear.updateMany(
          {},
          {
            $set: {
              isActive: false,
            },
          }
        );


        nextSchoolYear.isActive =
          true;


        await nextSchoolYear.save();

      }

    }


    res.status(200).json({
      success: true,
      message:
        "School year deleted successfully.",
    });

  } catch (error) {
    next(error);
  }
};