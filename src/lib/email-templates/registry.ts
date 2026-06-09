import type { ComponentType } from "react";

export interface TemplateEntry {
  // Templates have heterogeneous prop shapes, so the registry stores them loosely.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

import { template as adminNewSignup } from "./admin-new-signup";
import { template as contactMessage } from "./contact-message";

export const TEMPLATES: Record<string, TemplateEntry> = {
  "admin-new-signup": adminNewSignup,
  "contact-message": contactMessage,
};
