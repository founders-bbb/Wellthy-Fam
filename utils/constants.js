// Database column name constants — single source of truth
// Matches the Supabase schema exactly
export const DB_COLUMNS = {
  USERS: {
    ID: 'id',
    AUTH_USER_ID: 'auth_user_id',
    USER_TYPE: 'user_type',
    NAME: 'name',
    EMAIL: 'email',
    PHONE: 'phone',
    DOB: 'dob',
    GENDER: 'gender',
    HEIGHT: 'height',
    WEIGHT: 'weight',
    LOCATION: 'location',
    OCCUPATION: 'occupation',
    LANGUAGE: 'language',
    QUESTIONNAIRE_COMPLETED: 'questionnaire_completed',
    QUESTIONNAIRE_DATA: 'questionnaire_data',
    QUESTIONNAIRE_LAST_STEP: 'questionnaire_last_step',
    QUESTIONNAIRE_PENDING: 'questionnaire_pending',
    FAMILY_ID: 'family_id',
  },
};
