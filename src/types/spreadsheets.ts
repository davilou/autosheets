export interface SpreadsheetColumn {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'formula';
  required?: boolean;
  defaultValue?: string | number | boolean;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[];
  };
}

export interface SpreadsheetTemplate {
  id: string;
  name: string;
  description: string;
  category: 'betting' | 'finance' | 'analytics' | 'custom';
  columns: SpreadsheetColumn[];
  defaultFormatting?: {
    headerStyle?: {
      backgroundColor?: string;
      fontColor?: string;
      fontSize?: number;
      bold?: boolean;
    };
    dataValidation?: boolean;
    conditionalFormatting?: Array<{
      range: string;
      condition: string;
      format: {
        backgroundColor?: string;
        fontColor?: string;
      };
    }>;
  };
  isCustom?: boolean;
}

export interface UserSpreadsheet {
  id: string;
  name: string;
  description?: string;
  templateId?: string;
  templateName?: string;
  templateType: string;
  googleSheetsId?: string;
  googleSheetsUrl?: string;
  spreadsheetId: string;
  url: string;
  driveEmail: string | null;
  userId: string;
  isActive: boolean;
  isShared: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastBackup?: Date;
  autoBackup?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    nextBackup?: Date;
  };
  permissions?: {
    owner: string;
    shared: Array<{
      email: string;
      role: 'reader' | 'writer';
      addedAt: Date;
    }>;
  };
  stats?: {
    totalRows: number;
    lastActivity: Date;
    dataSize: number;
  };
}

export interface SpreadsheetBackup {
  id: string;
  originalSpreadsheetId: string;
  backupSpreadsheetId: string;
  name: string;
  type: 'manual' | 'automatic';
  createdAt: Date;
  userId: string;
  size: number;
}

export interface CreateSpreadsheetRequest {
  name: string;
  description?: string;
  templateType: 'basic' | 'advanced' | 'bankroll' | 'tipster' | 'custom' | 'clone_by_id';
  customColumns?: SpreadsheetColumn[];
  autoBackup?: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
  };
  // New fields to support Drive sharing and cloning by ID on the client side
  driveEmail?: string;
  templateSpreadsheetId?: string;
}

export interface ShareSpreadsheetRequest {
  emails: string[];
  role: 'reader' | 'writer';
}

export interface BackupSpreadsheetRequest {
  customName?: string;
}

export interface AutoBackupConfig {
  enabled: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly';
}

export interface SpreadsheetStats {
  totalSpreadsheets: number;
  activeSpreadsheets: number;
  totalBackups: number;
  storageUsed: number;
  lastActivity: Date;
}

export interface SpreadsheetDetails extends UserSpreadsheet {
  template: SpreadsheetTemplate;
  backups: SpreadsheetBackup[];
  recentActivity: Array<{
    type: 'created' | 'updated' | 'shared' | 'backup';
    timestamp: Date;
    details: string;
  }>;
}

// Tipos para validação de templates
export interface TemplateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Tipos para resposta das APIs
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface ListSpreadsheetsResponse {
  spreadsheets: UserSpreadsheet[];
  stats: SpreadsheetStats;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListTemplatesResponse {
  templates: SpreadsheetTemplate[];
  categories: string[];
}

// Tipos para Google Drive/Sheets integration
export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  createdTime: string;
  modifiedTime: string;
  size?: string;
  owners: Array<{
    displayName: string;
    emailAddress: string;
  }>;
}

export interface GoogleSheetsMetadata {
  spreadsheetId: string;
  properties: {
    title: string;
    locale: string;
    timeZone: string;
  };
  sheets: Array<{
    properties: {
      sheetId: number;
      title: string;
      gridProperties: {
        rowCount: number;
        columnCount: number;
      };
    };
  }>;
}

// Tipos para formatação de planilhas
export interface CellFormat {
  backgroundColor?: {
    red: number;
    green: number;
    blue: number;
  };
  textFormat?: {
    foregroundColor?: {
      red: number;
      green: number;
      blue: number;
    };
    fontSize?: number;
    bold?: boolean;
    italic?: boolean;
  };
  horizontalAlignment?: 'LEFT' | 'CENTER' | 'RIGHT';
  verticalAlignment?: 'TOP' | 'MIDDLE' | 'BOTTOM';
}

export interface ConditionalFormatRule {
  ranges: Array<{
    sheetId: number;
    startRowIndex: number;
    endRowIndex: number;
    startColumnIndex: number;
    endColumnIndex: number;
  }>;
  booleanRule?: {
    condition: {
      type: string;
      values?: Array<{
        userEnteredValue: string;
      }>;
    };
    format: CellFormat;
  };
}