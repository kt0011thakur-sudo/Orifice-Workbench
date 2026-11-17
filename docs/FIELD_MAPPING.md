# Editable field mapping

All 79 fields are listed in source-column order. Row 5 is the first tag; row 504 is the last supported tag. The field label matches the required row-4 header for XLSX import. Computed geometry helpers and repeated identifiers are omitted.

| Key | Type | Source column | Source header |
| --- | --- | --- | --- |
| tag | text | 01_Input Entry!A | Tag No |
| fluid | text | 01_Input Entry!B | Fluid Name |
| service | text | 01_Input Entry!C | Service / Line Description |
| phase | text | 01_Input Entry!D | Phase |
| pipeStandard | text | 01_Input Entry!E | Pipe Standard |
| sizeUnit | text | 01_Input Entry!F | Size Unit |
| size | text | 01_Input Entry!G | Line Size |
| schedule | text | 01_Input Entry!H | Schedule |
| pipeIdMode | text | 01_Input Entry!I | Pipe ID Mode |
| manualWtMm | number | 01_Input Entry!J | Manual WT mm |
| manualIdMm | number | 01_Input Entry!K | Manual Pipe ID mm |
| pipeMaterial | text | 01_Input Entry!Q | Pipe Material |
| pipeAlpha | number | 01_Input Entry!R | Pipe Alpha /K |
| roughnessUm | number | 01_Input Entry!S | Pipe Roughness um |
| flowUnit | text | 01_Input Entry!T | Flow Unit |
| flowMin | number | 01_Input Entry!U | Flow Min |
| flowNormal | number | 01_Input Entry!V | Flow Normal |
| flowMax | number | 01_Input Entry!W | Flow Max |
| flowFs | number | 01_Input Entry!X | Flow FS |
| temperatureUnit | text | 01_Input Entry!Y | Temperature Unit |
| temperatureMin | number | 01_Input Entry!Z | T Min |
| temperatureNormal | number | 01_Input Entry!AA | T Normal |
| temperatureMax | number | 01_Input Entry!AB | T Max |
| temperatureFs | number | 01_Input Entry!AC | T FS |
| pressureUnit | text | 01_Input Entry!AD | Pressure Unit |
| pressureMin | number | 01_Input Entry!AE | P Min |
| pressureNormal | number | 01_Input Entry!AF | P Normal |
| pressureMax | number | 01_Input Entry!AG | P Max |
| pressureFs | number | 01_Input Entry!AH | P FS |
| propertyBasis | text | 01_Input Entry!AI | Property Basis |
| densityUnit | text | 01_Input Entry!AJ | Density Unit |
| densityMin | number | 01_Input Entry!AK | Density Min |
| densityNormal | number | 01_Input Entry!AL | Density Normal |
| densityMax | number | 01_Input Entry!AM | Density Max |
| densityFs | number | 01_Input Entry!AN | Density FS |
| specificGravity | number | 01_Input Entry!AO | Specific Gravity |
| molecularWeight | number | 01_Input Entry!AP | Molecular Weight kg/kmol |
| zMin | number | 01_Input Entry!AQ | Z Min |
| zNormal | number | 01_Input Entry!AR | Z Normal |
| zMax | number | 01_Input Entry!AS | Z Max |
| zFs | number | 01_Input Entry!AT | Z FS |
| gamma | number | 01_Input Entry!AU | k / Gamma |
| viscosityUnit | text | 01_Input Entry!AV | Viscosity Unit |
| viscosity | number | 01_Input Entry!AW | Dynamic Viscosity |
| basePressureKpa | number | 01_Input Entry!AX | Base Pressure kPa abs |
| baseTemperatureC | number | 01_Input Entry!AY | Base Temperature C |
| baseZ | number | 01_Input Entry!AZ | Base Z |
| baseDensity | number | 01_Input Entry!BA | Base Density kg/m3 |
| propertySource | text | 01_Input Entry!BB | Property Source |
| straightRunBasis | text | 01_Input Entry!BC | Straight Run Basis |
| straightRunCase | text | 01_Input Entry!BD | Straight Run Case |
| requiredUpstreamD | number | 01_Input Entry!BE | Required Upstream D |
| requiredDownstreamD | number | 01_Input Entry!BF | Required Downstream D |
| availableUpstreamD | number | 01_Input Entry!BG | Available Upstream D |
| availableDownstreamD | number | 01_Input Entry!BH | Available Downstream D |
| thermalExpansion | text | 01_Input Entry!BI | Apply Thermal Expansion |
| plateAlpha | number | 01_Input Entry!BJ | Plate Alpha /K |
| revision | text | 01_Input Entry!BK | Revision |
| preparedBy | text | 01_Input Entry!BL | Prepared By |
| checkedBy | text | 01_Input Entry!BM | Checked By |
| approvedBy | text | 01_Input Entry!BN | Approved By |
| note | text | 01_Input Entry!BO | Engineering Note |
| mode | text | 02_Output Settings!D | Solve For |
| targetDp | number | 02_Output Settings!E | Target DP FS |
| dpUnit | text | 02_Output Settings!F | DP Unit |
| boreMm | number | 02_Output Settings!G | Input Bore mm |
| beta | number | 02_Output Settings!H | Input Beta |
| boreConfiguration | text | 02_Output Settings!I | Bore Configuration |
| taps | text | 02_Output Settings!J | Tap Type |
| standard | text | 02_Output Settings!K | Applicable Standard |
| cdMode | text | 02_Output Settings!L | Cd Mode |
| manualCd | number | 02_Output Settings!M | Manual Cd |
| betaMin | number | 02_Output Settings!N | Beta Min |
| betaMax | number | 02_Output Settings!O | Beta Max |
| minDp | number | 02_Output Settings!P | Min Allowable DP |
| maxDp | number | 02_Output Settings!Q | Max Allowable DP @ Max Flow |
| pipeVelocityLimit | number | 02_Output Settings!R | Max Pipe Velocity m/s |
| boreVelocityLimit | number | 02_Output Settings!S | Max Bore Velocity m/s |
| existingTolerancePct | number | 02_Output Settings!T | Existing Bore DP Tolerance % |
