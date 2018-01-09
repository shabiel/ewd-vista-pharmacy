
Contents:
- [1] Dataset format and how to add datasets
- [2] Twinlist url format
- [3] Handler information (for control changes)





[1] Dataset format and how to add datasets

Datasets are currently hard-coded in model.js in the "DATASETS" array
(search for "var DATASETS" in model.js). The following describes the expected
format for each dataset in "DATASETS":

<dataset name> : {
    "patientFirstName": <patient first name as a string, to be displayed on sign off button>,
    "patientLastName": <patient last name as a string, to be displayed on sign off button>,
    "patientAge": <patient last name as an integer, to be displayed on sign off button>,
    "patientGender": <patient last name as a single character string, to be displayed on sign off button>,
    
    "unique1": <array of integers indicating the ids of items that should be in 
                the intake unique list at the end>,
    "unique2": <array of integers indicating the ids of items that should be in 
                the hospital unique list at the end>,
    "identical": <array of arrays of integers - each sub-array contains ids of
                  items that are identical to each other. e.g. [[3, 26], [15, 18]]
                  means items 3 is identical to 26 (and vice-versa) and 15 is
                  identical to 18 (and vice-versa)>,
    "similar": <array of objects where each object contains an "items" attribute
                that provides an array of ids indicating similar items and a
                "differences" attribute that provides an array of strings where
                each string is the name of an attribute where the items differ
                (and will be highlighted in the interface).
                e.g. [
                        { items : [1, 28], differences : [visible.ATTR_NAME, visible.ATTR_DOSE] }
                     ]
                means items 1 and 28 are similar and differ in name and dose.
                string for attribute names can be found near the beginning of model.js>,
            
    "csv": <csv format string where the first line is: 
            "id,origin,recorded name,generic name,brand name,dose,route,frequency,drug classes,diagnoses\n"
            indicating the column names and subsequent lines (with newline "\n"
            between each line) providing drug information. The information includes:
            id - the item's id used in prior sections to indicate relationship data
            origin - either "list0" or "list1" indicating the Intake or Hospital list respectively
            recorded name - name that will be displayed in the item boxes
            generic name - generic name of drug
            brand name - brand name of drug
            dose - drug dosage
            route - prescribed route
            frequency - drug frequency
            drug classes - list of drug classes or single drug class
                Note: if a list, should be wrapped in double-quotes with no spaces
                between drug class strings. e.g. "drug class A,drug class B" not
                "drug class A, drug class B".
            diagnoses - list of diagnoses the drug is intended to treat, or single diagnoses
                See note for drug classes regarding format
            Note: there should not be any spaces between attributes. 
            e.g. "attr1,attr2,attr3" and not "attr1, attr2, attr3"
                See model.js for examples.>,
            
    "other_data": <object of id to additional attribute data for that id.
        In addition to the attributes in "csv" objects may have subitem
        information and date information. 
        e.g.
        {
            1: {
                "__ATTR_SUBITEM__": [
                    { name : "salmeterol", attributes : {"__ATTR_DOSE__" : "250 mg"} },
                    { name : "fluticasone", attributes : {"__ATTR_DOSE__" : "50 mg"} } ]
                },
            2: {
                "__ATTR_SUBITEM__": [
                    { name : "trimethoprim", attributes : {"__ATTR_DOSE__" : ""} },
                    { name : "sulfamethoxazole", attributes : {"__ATTR_DOSE__" : ""} } ],
                "__ATTR_DATE_STARTED__": ["started 3 days ago"]
                }
        }
        
        Indicates item 1 is made up of 250 mg of salmeterol and 50 mg
        of fluticasone. Item 2 is made up of trimethoprim and sulfamethoxazole
        with unspecified dosages. Item 2 also has date information of
        being started 3 days ago. Note that all information is stored
        as arrays of data (e.g. subitem data as array of subitem information
        and date information as an array containing a single string)>
}   // end of dataset object


Adding the above to "DATASETS" adds a dataset to Twinlist. However, the following
additional changes may also be necessary:

- updating model.js:visible.getDatasetShortName
    This function is used to retrieve dataset short names during log generation
    If logging isn't used, this is unnecessary.

- updating main.html
    If users will be accessing the dataset through main.html, adding another
    option to the set of available datasets (search main.html for: <select name="dataset">)
    may be useful. Note that the option value string must match the <dataset name> above
    If a direct link is used, (e.g. index.html?case=<dataset name>) then this
    may be unnecessary





[2] Twinlist url format

The format for Twinlist's url is:
index.html?case=<dataset name>&version=<version name>&animate=<autoAnimate type>

Note: all parameters (case, version, and animate) are optional and have the
following default values if not supplied
case = "__DATASET_APPENDECTOMY__"
version = "__VERSION_FULL__"
animate = "__AUTO_ANIMATE_ON__"

From the main page, three parameters can be supplied to determine:
1) the dataset to use in Twinlist
2) the version of Twinlist to start
3) whether to animate immediately, on clicking "compare lists" or not at all

Valid parameter values can be found by searching controller.js and model.js for "// config"
These include: (Note that in the url, double-quotes should not be present)

for case:
    "__DATASET_APPENDECTOMY__"
    "__DATASET_CONGESTIVE_HEART_FAILURE_1__" 
    "__DATASET_CONGESTIVE_HEART_FAILURE_2__"
    "__DATASET_PULMONARY_DISEASE_1__"
    "__DATASET_PULMONARY_DISEASE_2__"
    "__DATASET_OTHER_SIMPLE__"
    "__DATASET_OTHER_COMPLEX__"
    "__DATASET_OTHER_EXTRA__"
    "__DATASET_PULMONARY_DISEASE_2_CORRECTED__"
    "__DATASET_CONGESTIVE_HEART_FAILURE_1_MODIFIED__"

for version:
    "__VERSION_FULL__"              Full 5-column Twinlist version
    "__VERSION_BASELINE__"          Baseline 2-column version
    "__VERSION_LINK_ONLY__"         2-column version with similarity highlighting on hover
    "__VERSION_THREE_COLUMN__"      3-column Diagnoses version
    "__VERSION_3COL_CLASSES__"      3-column Drug classes version

for animate:
    "__AUTO_ANIMATE_ON__"           Animate automatically on page load
    "__AUTO_ANIMATE_OFF__"          Don't animate until "compare lists" is clicked
    "__AUTO_ANIMATE_END__"          Jump to the end of the animation

Default behavior is specified:
for case by model.js:visible.DATASET_DEFAULT
for version by controller.js:visible.versionDefault
for animate by controller.js:visible.autoAnimateDefault





[3] Handler information (for control changes)

Handlers for actions in Twinlist are all defined in controller.js:prepareHandlers
(can be found by search for "// touch-controls" in controller.js)
