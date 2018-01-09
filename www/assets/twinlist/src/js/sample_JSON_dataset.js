var sampleJSONStr = '{ "original_list_2": [ "Warfarin Sodium 2.5 MG Tablet;TAKE AS DIRECTED.; Rx", " Warfarin Sodium 5 MG Tablet;TAKE 1 TABLET DAILY AS DIRECTED.; Rx", " Carvedilol 25 MG Tablet;TAKE 1 TABLET TWICE DAILY, WITH MORNING AND EVENING MEAL; Rx", " Lipitor 10 MG Tablet;TAKE 1 TABLET DAILY.; Rx", " Lisinopril 5 MG Tablet;TAKE 1 TABLET TWICE DAILY; Rx", " Synthroid 100 MCG Tablet;TAKE 1 TABLET DAILY.; Rx", " Pantoprazole Sodium 40 MG Tablet Delayed Release;TAKE 1 TABLET DAILY.; Rx", " Sertraline HCl 50 MG Tablet;TAKE 1 TABLET DAILY.; Rx", " Mirapex 0.5 MG Tablet;TAKE 1 TABLET 3 TIMES DAILY.; Rx" ], "reconciled": [ { "med2": { "original_string": "Carvedilol 25 MG Tablet;TAKE 1 TABLET TWICE DAILY, WITH MORNING AND EVENING MEAL; Rx", "medicationName": "CARVEDILOL", "dose": "25", "formulation": "TABLET", "units": "MG", "instructions": "TAKE 1 TABLET TWICE DAILY, WITH MORNING AND EVENING MEAL; RX", "provenance": "EHR", "parsed": true }, "med1": { "original_string": "Coreg 25 MG Tablet;TAKE 1 TABLET TWICE DAILY, WITH MORNING AND EVENING MEAL; RPT", "medicationName": "COREG", "dose": "25", "formulation": "TABLET", "units": "MG", "instructions": "TAKE 1 TABLET TWICE DAILY, WITH MORNING AND EVENING MEAL; RPT", "provenance": "Patient", "startDate": "2011.12.24", "parsed": true }, "score": 1.0, "mechanism": "brand name" }, { "med2": { "original_string": "Warfarin Sodium 2.5 MG Tablet;TAKE AS DIRECTED.; Rx", "medicationName": "WARFARIN SODIUM", "dose": "2.5", "formulation": "TABLET", "units": "MG", "instructions": "TAKE AS DIRECTED.; RX", "provenance": "EHR", "parsed": true }, "med1": { "original_string": "Warfarin Sodium 2.5 MG Tablet;TAKE AS DIRECTED.; Rx", "medicationName": "WARFARIN SODIUM", "dose": "2.5", "formulation": "TABLET", "units": "MG", "instructions": "TAKE AS DIRECTED.; RX", "provenance": "Patient", "parsed": true }, "score": 1.0, "mechanism": "string matching" }, { "med2": { "original_string": "Lipitor 10 MG Tablet;TAKE 1 TABLET DAILY.; Rx", "medicationName": "LIPITOR", "dose": "10", "formulation": "TABLET", "units": "MG", "instructions": "TAKE 1 TABLET DAILY.; RX", "provenance": "EHR", "parsed": true }, "med1": { "original_string": "Lipitor 10 MG Tablet;TAKE 1 TABLET DAILY.; Rx", "medicationName": "LIPITOR", "dose": "10", "formulation": "TABLET", "units": "MG", "instructions": "TAKE 1 TABLET DAILY.; RX", "provenance": "Patient", "parsed": true }, "score": 1.0, "mechanism": "string matching" }, { "med2": { "original_string": "Warfarin Sodium 5 MG Tablet;TAKE 1 TABLET DAILY AS DIRECTED.; Rx", "medicationName": "WARFARIN SODIUM", "dose": "5", "formulation": "TABLET", "units": "MG", "instructions": "TAKE 1 TABLET DAILY AS DIRECTED.; RX", "provenance": "EHR", "parsed": true }, "med1": { "original_string": "Warfarin Sodium 5 MG Tablet;TAKE 1 TABLET DAILY AS DIRECTED.; Rx", "medicationName": "WARFARIN SODIUM", "dose": "5", "formulation": "TABLET", "units": "MG", "instructions": "TAKE 1 TABLET DAILY AS DIRECTED.; RX", "provenance": "Patient", "parsed": true }, "score": 1.0, "mechanism": "string matching" }, { "med2": { "original_string": "Mirapex 0.5 MG Tablet;TAKE 1 TABLET 3 TIMES DAILY.; Rx", "medicationName": "MIRAPEX", "dose": "0.5", "formulation": "TABLET", "units": "MG", "instructions": "TAKE 1 TABLET 3 TIMES DAILY.; RX", "provenance": "EHR", "parsed": true }, "med1": { "original_string": "Mirapex 0.5 MG Tablet;TAKE 1 TABLET 3 TIMES DAILY.; Rx", "medicationName": "MIRAPEX", "dose": "0.5", "formulation": "TABLET", "units": "MG", "instructions": "TAKE 1 TABLET 3 TIMES DAILY.; RX", "provenance": "Patient", "parsed": true }, "score": 1.0, "mechanism": "string matching" }, { "med2": { "original_string": "Sertraline HCl 50 MG Tablet;TAKE 1 TABLET DAILY.; Rx", "medicationName": "SERTRALINE HCL", "dose": "50", "formulation": "TABLET", "units": "MG", "instructions": "TAKE 1 TABLET DAILY.; RX", "provenance": "EHR", "parsed": true }, "med1": { "original_string": "Zoloft 50 MG Tablet;TAKE 1 TABLET DAILY.; RPT", "medicationName": "ZOLOFT", "dose": "50", "formulation": "TABLET", "units": "MG", "instructions": "TAKE 1 TABLET DAILY.; RPT", "provenance": "Patient", "parsed": true }, "score": 1.0, "mechanism": "ingredients list" }, { "med2": { "original_string": "Pantoprazole Sodium 40 MG Tablet Delayed Release;TAKE 1 TABLET DAILY.; Rx", "medicationName": "PANTOPRAZOLE SODIUM", "dose": "40", "formulation": "TABLET DELAYED RELEASE", "units": "MG", "instructions": "TAKE 1 TABLET DAILY.; RX", "provenance": "EHR", "parsed": true }, "med1": { "original_string": "Protonix 40 MG Tablet Delayed Release;TAKE 1 TABLET DAILY.; Rx", "medicationName": "PROTONIX", "dose": "40", "formulation": "TABLET DELAYED RELEASE", "units": "MG", "instructions": "TAKE 1 TABLET DAILY.; RX", "provenance": "Patient", "parsed": true }, "score": 0.6666666666666666, "mechanism": "ingredients list" }, { "med2": { "original_string": "Lisinopril 5 MG Tablet;TAKE 1 TABLET TWICE DAILY; Rx", "medicationName": "LISINOPRIL", "dose": "5", "formulation": "TABLET", "units": "MG", "instructions": "TAKE 1 TABLET TWICE DAILY; RX", "provenance": "EHR", "parsed": true }, "med1": { "original_string": "Lisinopril 5 MG Tablet;TAKE TABLET TWICE DAILY; Rx", "medicationName": "LISINOPRIL", "dose": "5", "formulation": "TABLET", "units": "MG", "instructions": "TAKE TABLET TWICE DAILY; RX", "provenance": "Patient", "parsed": true }, "score": 1.0, "mechanism": "ingredients list" } ], "original_list_1": [ "Zoloft 50 MG Tablet;TAKE 1 TABLET DAILY.; RPT", " Warfarin Sodium 2.5 MG Tablet;TAKE AS DIRECTED.; Rx", " Lipitor 10 MG Tablet;TAKE 1 TABLET DAILY.; Rx", " Protonix 40 MG Tablet Delayed Release;TAKE 1 TABLET DAILY.; Rx", " Warfarin Sodium 5 MG Tablet;TAKE 1 TABLET DAILY AS DIRECTED.; Rx", " Mirapex 0.5 MG Tablet;TAKE 1 TABLET 3 TIMES DAILY.; Rx", " Lisinopril 5 MG Tablet;TAKE TABLET TWICE DAILY; Rx", " Coreg 25 MG Tablet;TAKE 1 TABLET TWICE DAILY, WITH MORNING AND EVENING MEAL; RPT", " " ], "new_list_2": [ { "original_string": "Synthroid 100 MCG Tablet;TAKE 1 TABLET DAILY.; Rx", "medicationName": "SYNTHROID", "dose": "100", "formulation": "TABLET", "units": "MCG", "instructions": "TAKE 1 TABLET DAILY.; RX", "provenance": "EHR", "parsed": true } ], "new_list_1": [] }';