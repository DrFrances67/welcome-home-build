/* eslint-disable react-refresh/only-export-components */
/* Barrel for the worksheet builder's shared pieces.
 * The implementation lives in three focused modules:
 *   worksheet-primitives.tsx — buttons, inputs, shapes, scaling wrapper
 *   worksheet-elements.tsx   — element rendering and per-element editors
 *   worksheet-modals.tsx     — standards, versions, export, help, alignment
 */
export { BANDS, GRADES, gInfo } from "@/data/grades";
export {
  IMG_STYLES,
  PALETTE,
  WORKSHEET_FONTS,
  SHAPE_TYPES,
  DOK_LEVEL_DEFS,
  VERSION_LABELS,
} from "@/data/worksheet-options";
export { F, FF, PRINT_CSS } from "@/lib/worksheet-styles";
export {
  uid,
  COLS,
  COL_GAP_PCT,
  COL_W_PCT,
  ROW_HEIGHT,
  nextSlot,
  mkEl,
  BASELINE_WIDTH_PCT,
  BASELINE_HEIGHT_PX,
  SCALE_MIN,
  SCALE_MAX,
  clampScale,
  resizeScaleFor,
  shuffle,
  isQuestion,
  gradeIdToStdBand,
  elSummary,
} from "@/lib/worksheet-utils";
export { Btn, LBL, INP, ShapeSVG, ScaledContent } from "./worksheet-primitives";
export {
  ElView,
  ElEditor,
  DokEditor,
  ChecklistEditor,
  CustomShapeEditor,
} from "./worksheet-elements";
export {
  StandardsModal,
  VersionsModal,
  ExportModal,
  HelpModal,
  AlignmentModal,
} from "./worksheet-modals";
