-- Fictional demo data only. Brings the database in line with "NHI-Connect Demo Patient Dataset":
-- 6 patients across 6 connected facilities.

-- ---------------------------------------------------------------------------
-- Facilities
-- ---------------------------------------------------------------------------
INSERT INTO hospital_facility VALUES
 ('11111111-0000-0000-0000-000000000004','Mthatha Regional Hospital','Mthatha Regional','Eastern Cape','FILE_EXTRACT','ACTIVE','2025-05-20','2026-07-21 23:50+02'),
 ('11111111-0000-0000-0000-000000000005','Mangaung Academic Hospital','Mangaung Academic','Free State','API','ACTIVE','2025-06-11','2026-07-26 05:30+02'),
 ('11111111-0000-0000-0000-000000000006','Polokwane Provincial Hospital','Polokwane Provincial','Limpopo','MESSAGE_ENDPOINT','ACTIVE','2025-07-01','2026-07-23 19:15+02');

-- ---------------------------------------------------------------------------
-- Patient 1: Bongani Mahlangu (already seeded in V2) - align wording, add 2019 visit
-- ---------------------------------------------------------------------------
UPDATE encounter SET
  title = 'Emergency Admission — Acute Abdominal Pain',
  notes = 'Presented to the emergency department in Johannesburg with severe right lower-quadrant pain. Ultrasound suggested acute appendicitis. Emergency laparoscopic appendectomy performed without complication.'
WHERE encounter_id = '33333333-0000-0000-0000-000000000001';

UPDATE encounter SET
  title = 'Post-Operative Follow-up — Wound Review',
  notes = 'Patient relocated to Cape Town for work and presented for a routine post-appendectomy wound check. Reviewing clinician retrieved the April surgical record via the patient''s ID number and confirmed the prior laparoscopic appendectomy, avoiding repeat imaging or bloods. Wound healing well, sutures removed, no signs of infection.'
WHERE encounter_id = '33333333-0000-0000-0000-000000000002';

UPDATE encounter SET
  title = 'Outpatient Consultation — Raised Blood Pressure',
  notes = 'Patient, now living in Durban, presented to a hospital that had never previously treated him, complaining of headaches. The attending clinician had no prior relationship with this patient but retrieved his complete national record — including the Gauteng appendectomy and Cape Town follow-up — using only his ID number. Blood pressure measured at 152/96 mmHg on two readings; no other new complaints given the clear surgical history already on file.'
WHERE encounter_id = '33333333-0000-0000-0000-000000000003';

UPDATE observation SET
  value = 'WCC 14.2 x10⁹/L (raised), CRP 68 mg/L (raised) — consistent with acute appendicitis. Repeated post-operatively: WCC normalising.'
WHERE patient_id = '22222222-0000-0000-0000-000000000001' AND display_name = 'Full Blood Count & CRP';

UPDATE observation SET
  value = 'FBC and CRP within normal limits, confirming resolution of post-operative inflammation. No further imaging required given full history was already on file.'
WHERE patient_id = '22222222-0000-0000-0000-000000000001' AND display_name = 'Routine Bloods (Post-Op Check)';

UPDATE medication SET
  dosage = 'Once daily, intravenous. Post-operative prophylactic antibiotic course following appendectomy, 3 days.'
WHERE patient_id = '22222222-0000-0000-0000-000000000001' AND display_name = 'Ceftriaxone 1g IV';

UPDATE medication SET
  dosage = 'Once daily, oral. Newly initiated for suspected hypertension identified during this visit, to be reviewed in 4 weeks.'
WHERE patient_id = '22222222-0000-0000-0000-000000000001' AND display_name = 'Amlodipine 5mg';

INSERT INTO encounter VALUES
 ('33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','OUTPATIENT','Outpatient Consultation — Annual Wellness Check','Routine annual check-up. No acute complaints. Blood pressure and weight within normal range; advised general lifestyle counselling.','2019-08-14 09:00+02',NULL);

INSERT INTO observation VALUES
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000004','22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','GLUCOSE-LIPID','LAB-31','Fasting Glucose & Lipogram','Fasting glucose 5.1 mmol/L, total cholesterol 4.8 mmol/L — both within normal limits at the time.',NULL,'2019-08-14 10:00+02');

-- ---------------------------------------------------------------------------
-- Patients 2-6
-- ---------------------------------------------------------------------------
INSERT INTO patient VALUES
 ('22222222-0000-0000-0000-000000000002','9509185412089','Naledi','Mokoena','1995-09-18','Female',now()),
 ('22222222-0000-0000-0000-000000000003','7203150460080','Thandeka','Zulu','1972-03-15','Female',now()),
 ('22222222-0000-0000-0000-000000000004','5811305129087','Pieter','van der Berg','1958-11-30','Male',now()),
 ('22222222-0000-0000-0000-000000000005','0106220785088','Lerato','Molefe','2001-06-22','Female',now()),
 ('22222222-0000-0000-0000-000000000006','1509055401086','Sipho','Ndlovu','2015-09-05','Male',now());

INSERT INTO master_patient_index VALUES
 (gen_random_uuid(),'22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','BGH-007731','AUTO_MATCHED',now()),
 (gen_random_uuid(),'22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004','MRH-20419','AUTO_MATCHED',now()),
 (gen_random_uuid(),'22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003','UDH-3388','AUTO_MATCHED',now()),
 (gen_random_uuid(),'22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000005','MAH-55102','AUTO_MATCHED',now()),
 (gen_random_uuid(),'22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000002','TBP-91407','AUTO_MATCHED',now()),
 (gen_random_uuid(),'22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000006','PPH-12876','AUTO_MATCHED',now()),
 (gen_random_uuid(),'22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000001','BGH-009214','AUTO_MATCHED',now()),
 (gen_random_uuid(),'22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000001','BGH-003390','AUTO_MATCHED',now()),
 (gen_random_uuid(),'22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000006','PPH-14402','AUTO_MATCHED',now());

-- Patient 2: Naledi Mokoena (1 entry)
INSERT INTO encounter VALUES
 ('33333333-0000-0000-0000-000000000010','22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','OUTPATIENT','Outpatient Consultation — Respiratory Symptoms','Presented with a mild persistent cough. Chest clear on auscultation. Advised symptomatic management.','2026-06-14 10:30+02',NULL);

-- Patient 3: Thandeka Zulu (7 entries)
INSERT INTO encounter VALUES
 ('33333333-0000-0000-0000-000000000020','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004','OUTPATIENT','Outpatient Consultation — Chronic Cough & Weight Loss','Six-week history of productive cough, night sweats and 6 kg weight loss. Sputum sent for GeneXpert; HIV test offered and accepted.','2021-02-09 09:00+02',NULL),
 ('33333333-0000-0000-0000-000000000021','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003','OUTPATIENT','ART Transfer-In — Relocated to Durban','Patient relocated for work. Receiving clinician retrieved her full Eastern Cape TB and ART history by ID number, so no repeat baseline work-up was needed. ART continued without interruption.','2024-09-18 10:00+02',NULL);

INSERT INTO observation VALUES
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000020','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004','GENEXPERT-MTB-RIF','MRH-L07','GeneXpert MTB/RIF','MTB detected, rifampicin resistance not detected. Drug-sensitive pulmonary TB confirmed.',NULL,'2021-02-11 09:00+02'),
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000020','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004','HIV-RAPID-CD4','MRH-L15','HIV Rapid Test & CD4 Count','HIV positive (confirmed on second rapid test). CD4 count 210 cells/µL.',NULL,'2021-02-11 11:00+02'),
 (gen_random_uuid(),NULL,'22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000003','HIV-VIRAL-LOAD','UDH-L42','HIV Viral Load','Viral load <50 copies/mL — virally suppressed. Continue current regimen; next viral load in 12 months.',NULL,'2026-03-04 09:00+02');

INSERT INTO medication VALUES
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000020','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004','RHZE-FDC','MRH-M21','TB Treatment (RHZE) — Intensive Phase','Fixed-dose rifampicin/isoniazid/pyrazinamide/ethambutol daily for 2 months, followed by 4-month continuation phase. Completed August 2021.','2021-02-15','2021-08-15'),
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000020','22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000004','TLD','MRH-M30','TLD (Tenofovir/Lamivudine/Dolutegravir)','Once daily, oral. Antiretroviral therapy initiated two weeks into TB treatment per guidelines. Ongoing.','2021-03-01',NULL);

-- Patient 4: Pieter van der Berg (6 entries)
INSERT INTO encounter VALUES
 ('33333333-0000-0000-0000-000000000030','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000005','EMERGENCY','Emergency Admission — Acute Myocardial Infarction','Presented with crushing central chest pain. ECG showed anterior ST elevation. Primary PCI with one drug-eluting stent to the LAD. Discharged day 4.','2023-05-21 07:40+02','2023-05-24 11:00+02'),
 ('33333333-0000-0000-0000-000000000031','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000002','OUTPATIENT','Cardiology Outpatient Review','Retired to Cape Town. Cardiologist reviewed the Free State PCI record and discharge medications via NHI-Connect. Asymptomatic, exercise tolerance good.','2025-11-12 10:00+02',NULL);

INSERT INTO observation VALUES
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000030','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000005','TROPONIN-T-HS','MAH-L03','Troponin T (High-Sensitivity)','Peak 2,840 ng/L (reference <14 ng/L), consistent with acute myocardial infarction.',NULL,'2023-05-21 09:00+02'),
 (gen_random_uuid(),NULL,'22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000002','LIPID-PANEL','TB-L20','Lipid Panel','LDL 1.6 mmol/L (target <1.8), total cholesterol 3.4 mmol/L. At target on current statin dose.',NULL,'2026-06-03 09:00+02');

INSERT INTO medication VALUES
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000030','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000005','ASPIRIN-CLOPIDOGREL','MAH-M11','Aspirin 100mg + Clopidogrel 75mg','Dual antiplatelet therapy for 12 months post-stent, then aspirin alone long-term.','2023-05-24',NULL),
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000030','22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000005','ATORVASTATIN-80MG','MAH-M14','Atorvastatin 80mg','Once daily at night. High-intensity statin for secondary prevention. Ongoing.','2023-05-24',NULL);

-- Patient 5: Lerato Molefe (6 entries)
INSERT INTO encounter VALUES
 ('33333333-0000-0000-0000-000000000040','22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000006','ANTENATAL','First Antenatal Visit (Booking) — 12 Weeks','First pregnancy. Booking bloods taken, dating scan consistent with 12 weeks. Blood pressure 118/74 mmHg.','2025-10-07 09:00+02',NULL),
 ('33333333-0000-0000-0000-000000000041','22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000001','EMERGENCY','Emergency Admission — Pre-eclampsia at 37 Weeks','Visiting family in Johannesburg when she developed headache and swelling. BP 162/108 mmHg. Admitting team saw her Limpopo booking bloods and blood group immediately. Emergency caesarean section; healthy baby girl, 2.9 kg.','2026-04-02 08:30+02','2026-04-05 10:00+02'),
 ('33333333-0000-0000-0000-000000000042','22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000006','OUTPATIENT','Postnatal Follow-up — 6 Weeks','Back home in Polokwane. Local clinician reviewed the Gauteng delivery and pre-eclampsia record. BP now 124/80 mmHg, wound healed. Advised BP check at every future visit.','2026-05-14 10:00+02',NULL);

INSERT INTO observation VALUES
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000040','22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000006','ANC-BOOKING-BLOODS','PPH-L02','Antenatal Booking Bloods','Haemoglobin 10.4 g/dL (mild anaemia), blood group O Rh-positive, syphilis RPR negative, HIV negative.',NULL,'2025-10-07 11:00+02');

INSERT INTO medication VALUES
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000040','22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000006','FERROUS-FOLIC','PPH-M05','Ferrous Sulphate + Folic Acid','Daily antenatal supplementation for mild anaemia. Continued until delivery.','2025-10-07','2026-04-02'),
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000041','22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000001','MAGNESIUM-SULPHATE-IV','MED-0410','Magnesium Sulphate IV','Seizure prophylaxis for severe pre-eclampsia, 24 hours post-delivery.','2026-04-02','2026-04-03');

-- Patient 6: Sipho Ndlovu (5 entries)
INSERT INTO encounter VALUES
 ('33333333-0000-0000-0000-000000000050','22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000001','EMERGENCY','Emergency Visit — Acute Wheeze (age 3)','Brought in by mother with wheeze and difficulty breathing after a cold. Responded well to nebulised salbutamol. Discharged with inhaler and spacer.','2019-07-22 20:15+02','2019-07-23 02:00+02'),
 ('33333333-0000-0000-0000-000000000051','22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000001','OUTPATIENT','Paediatric Clinic — Asthma Diagnosis','Recurrent wheeze with colds and night cough. Diagnosed with childhood asthma. Inhaler technique taught to mother.','2022-04-10 09:30+02',NULL),
 ('33333333-0000-0000-0000-000000000052','22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000006','EMERGENCY','Emergency Visit — Asthma Exacerbation','Family moved to Limpopo. Attending clinician confirmed asthma diagnosis and current preventer from the Gauteng record, avoiding a repeat chest X-ray. Treated with salbutamol and a short course of oral prednisolone.','2026-01-19 14:00+02','2026-01-19 19:00+02');

INSERT INTO observation VALUES
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000052','22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000006','PEAK-FLOW','PPH-L19','Peak Expiratory Flow','Pre-treatment 140 L/min (55% predicted); post-treatment 220 L/min (85% predicted). Discharged home.',NULL,'2026-01-19 15:00+02');

INSERT INTO medication VALUES
 (gen_random_uuid(),'33333333-0000-0000-0000-000000000051','22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000001','BUDESONIDE-200','MED-0618','Budesonide Inhaler 200µg','One puff twice daily via spacer as preventer. Salbutamol as needed for symptoms. Ongoing.','2022-04-10',NULL);
