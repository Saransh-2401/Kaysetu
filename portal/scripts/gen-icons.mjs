// One-off generator for the hybrid animated-icon registry.
//   node scripts/gen-icons.mjs
// Reads which icons are available animated from @animateicons/react, then emits:
//   components/icons/iconMap.ts   (imports + ICON_MAP + lookupIcon)
//   components/icons/index.tsx    (AppIcon + makeIcon + one shim per MUI name)
// Animated (@animateicons/react/lucide) is preferred; otherwise static lucide-react.

import fs from "fs";
import path from "path";

const root = path.resolve(".");
const distLucide = path.join(root, "vendor/animateicons/lucide.js");
const raw = fs.readFileSync(distLucide, "utf8");
const ANIM = new Set(
  [...raw.matchAll(/as\s+([A-Za-z0-9_]+)Icon\b/g)].map((m) => m[1])
);

// MUI icon name (no "Icon") -> lucide base name.
const MAP = {
  AccessTime: "Clock", AccountBalance: "Landmark", AccountBalanceWallet: "Wallet",
  AccountTree: "Workflow", Add: "Plus", AddBox: "PackagePlus", AddCircleOutline: "CirclePlus",
  AddPhotoAlternate: "ImagePlus", AddShoppingCart: "ShoppingCart", AdminPanelSettings: "ShieldUser",
  Android: "Smartphone", ArrowBack: "ArrowLeft", ArrowDownward: "ArrowDown", ArrowForward: "ArrowRight",
  ArrowUpward: "ArrowUp", Assessment: "ChartColumn", Assignment: "Clipboard", AssignmentInd: "UserCheck",
  AssignmentTurnedIn: "ClipboardCheck", Backup: "CloudUpload", Badge: "IdCard", BarChart: "ChartColumn",
  Block: "Ban", Notifications: "Bell",
  Business: "Building2", CalendarMonth: "Calendar", CalendarToday: "CalendarDays", CallMade: "ArrowUpRight",
  Cancel: "X", CancelOutlined: "CircleX", CancelTwoTone: "CircleX", Category: "Tags", Check: "Check",
  CheckCircle: "CircleCheck", CheckCircleOutline: "CircleCheck", CheckCircleTwoTone: "CircleCheckBig",
  ChevronLeft: "ChevronLeft", ChevronRight: "ChevronRight", Clear: "X", Close: "X", CloudUpload: "CloudUpload",
  Commute: "Bus", CompareArrows: "ArrowLeftRight", ContactPage: "Contact", ContentCopy: "Copy",
  ContentPaste: "ClipboardPaste", CreditCard: "CreditCard", CurrencyExchange: "ArrowRightLeft",
  CurrencyRupee: "IndianRupee", Dashboard: "Dashboard", Delete: "Trash2", DeleteOutline: "Trash2",
  DeleteTwoTone: "Trash2", Description: "FileText", DirectionsRun: "Footprints", DirectionsWalk: "Footprints",
  Domain: "Building2", DoNotDisturbOnTwoTone: "CircleMinus", Download: "Download", Edit: "Pencil",
  EditOutlined: "Pencil", EditTwoTone: "Pencil", Email: "Mail", EmojiEvents: "Trophy", Engineering: "HardHat",
  Error: "CircleAlert", ErrorOutline: "CircleAlert", ErrorOutlineTwoTone: "CircleAlert",
  EventAvailable: "CalendarCheck", EventNote: "CalendarDays", EventRepeat: "CalendarClock",
  ExitToApp: "Logout", ExpandLess: "ChevronUp", ExpandMore: "ChevronDown", Factory: "Factory",
  FileDownload: "Download", FilterAlt: "Filter", FilterAltOff: "FilterX", FilterList: "SlidersHorizontal",
  Flag: "Flag", GpsFixed: "LocateFixed", GraphicEq: "AudioLines", GridView: "LayoutGrid", Group: "Users",
  Groups: "UsersRound", HighlightOff: "CircleX", History: "History", Home: "House", HomeWork: "Building2",
  HourglassEmpty: "Hourglass",
  HowToReg: "UserCheck", Info: "Info", InfoOutlined: "Info", Inventory: "Package", Inventory2: "Boxes",
  Inventory2Outlined: "Boxes", KeyboardArrowDown: "ChevronDown", KeyboardArrowRight: "ChevronRight",
  KeyboardArrowUp: "ChevronUp", Language: "Globe", ListAlt: "LayoutList", LocalOffer: "Tag",
  LocalShipping: "Truck", LocationCity: "Building2", LocationOn: "MapPin", Lock: "Lock", LockPerson: "UserLock",
  Logout: "Logout", Map: "Map", Menu: "Menu", MenuBook: "BookOpen", Mic: "Mic", MonetizationOn: "DollarSign",
  MoreVert: "EllipsisVertical", MoveToInbox: "Inbox", MyLocation: "LocateFixed", NoteAdd: "FilePlus",
  Notes: "StickyNote", NotificationsActive: "BellRing", OpenInNew: "ExternalLink", Paid: "BadgeDollar",
  Palette: "Palette", Payment: "CreditCard", Payments: "Wallet", Pending: "Clock", PendingActions: "Hourglass",
  PeopleAlt: "UsersRound", Percent: "Percent", Person: "User", PersonAdd: "UserPlus", Phone: "Phone",
  PhotoCamera: "Camera", PictureAsPdf: "FileText", Place: "MapPin", PlayArrow: "Play", PlayCircle: "CirclePlay",
  PlayCircleOutline: "CirclePlay", PlaylistAdd: "ListPlus", PostAdd: "FilePlus", PrecisionManufacturing: "Factory",
  Print: "Printer", Public: "Globe", PublishedWithChanges: "RefreshCw", RadioButtonUnchecked: "Circle",
  Receipt: "Receipt", ReceiptLong: "ReceiptText", Refresh: "RefreshCw", Remove: "Minus",
  RemoveCircleOutline: "CircleMinus", ReportProblem: "TriangleAlert", RequestPage: "FileText",
  RequestQuote: "FileText", RestartAlt: "RotateCcw", Route: "Route", Save: "Save", Scale: "Scale",
  Science: "FlaskConical", Search: "Search", SearchOff: "SearchX", Security: "ShieldCheck", SelectAll: "ListChecks",
  Send: "Send", Settings: "Settings", SettingsSuggest: "Settings", Shield: "Shield", ShoppingBag: "ShoppingBag",
  ShoppingCart: "ShoppingCart", ShowChart: "ChartLine", SignalCellularAlt: "Signal", Smartphone: "Smartphone",
  Sms: "MessageCircle", Sort: "ArrowDownUp", Speed: "Gauge", StickyNote2Outlined: "StickyNote", Stop: "Square",
  Store: "Store", Storefront: "Store", SupervisorAccount: "UsersRound", SupportAgent: "Headset",
  SwapHoriz: "ArrowLeftRight", SystemUpdate: "MonitorDown", TableRows: "Rows3", Timeline: "Activity",
  Timer: "Timer", TrendingDown: "TrendingDown", TrendingUp: "TrendingUp", Tune: "SlidersHorizontal",
  Upload: "Upload", UploadFile: "Upload", Verified: "BadgeCheck", VerifiedUser: "ShieldCheck", Visibility: "Eye",
  VisibilityOff: "EyeOff", VisibilityTwoTone: "Eye", Warehouse: "Warehouse", Warning: "TriangleAlert",
  WarningAmber: "TriangleAlert", WatchLater: "Clock", WhatsApp: "MessageCircle", Wifi: "Wifi",
  ViewKanban: "Columns3", ViewList: "List", ViewModule: "LayoutGrid",
};

const animBases = new Set();
const staticBases = new Set();
for (const base of Object.values(MAP)) {
  if (ANIM.has(base)) animBases.add(base);
  else staticBases.add(base);
}
staticBases.add("Circle"); // fallback

const sortedAnim = [...animBases].sort();
const sortedStatic = [...staticBases].sort();

// CSS micro-animation type per static (lucide) glyph (played on hover). Default "pop".
const STATIC_ANIM = {
  RefreshCw: "spin", RotateCcw: "spin", History: "spin",
  Pencil: "wiggle", Filter: "wiggle", FilterX: "wiggle",
  ArrowDown: "bounce", ArrowUp: "bounce", Inbox: "bounce", PackagePlus: "bounce",
  FilePlus: "bounce", ListPlus: "bounce", ImagePlus: "bounce",
  Truck: "slide", Bus: "slide", ArrowLeft: "slide", ArrowRight: "slide",
  ArrowLeftRight: "slide", ArrowRightLeft: "slide", ArrowUpRight: "slide",
  Footprints: "slide", Route: "slide",
  Flag: "swing", Trophy: "swing", BadgeCheck: "swing",
  Ban: "shake", CircleAlert: "shake", CircleX: "shake", CircleMinus: "shake", SearchX: "shake",
  Shield: "pulse", Circle: "pulse", IdCard: "pulse",
};

// ---- iconMap.ts ----
let m = `// AUTO-GENERATED by scripts/gen-icons.mjs — do not edit by hand.\n`;
m += `// Hybrid icon registry: animated (@animateicons/react) where available, else static (lucide-react).\n`;
m += `// Every glyph renders an SVG with stroke="currentColor", so icons follow the active color scheme.\n\n`;
m += `import type { ComponentType } from "react";\n`;
for (const b of sortedAnim) m += `import { ${b}Icon as Av_${b} } from "@/vendor/animateicons/lucide";\n`;
m += `import FallbackIcon from "./FallbackIcon";\n`;
m += `\nexport type IconComponent = ComponentType<{ size?: number; className?: string }>;\n`;
m += `interface IconEntry { C: IconComponent; animated: boolean; anim?: string; }\n\n`;
m += `export const ICON_MAP: Record<string, IconEntry> = {\n`;
for (const [mui, base] of Object.entries(MAP)) {
  const anim = ANIM.has(base);
  const extra = anim ? "" : `, anim: ${JSON.stringify(STATIC_ANIM[base] || "pop")}`;
  m += `  ${JSON.stringify(mui)}: { C: ${anim ? `Av_${base}` : "FallbackIcon"}, animated: ${anim}${extra} },\n`;
}
m += `};\n\n`;
m += `export const FALLBACK: IconEntry = { C: FallbackIcon, animated: false, anim: "pop" };\n\n`;
m += `export function lookupIcon(name: string): IconEntry {\n`;
m += `  const entry = ICON_MAP[name];\n`;
m += `  if (!entry) {\n`;
m += `    if (process.env.NODE_ENV !== "production") {\n`;
m += `      // eslint-disable-next-line no-console\n`;
m += `      console.warn(\`[AppIcon] No mapping for "\${name}" — using fallback.\`);\n`;
m += `    }\n`;
m += `    return FALLBACK;\n`;
m += `  }\n`;
m += `  return entry;\n`;
m += `}\n`;
fs.writeFileSync(path.join(root, "components/icons/iconMap.ts"), m);

// ---- index.tsx ----
let idx = `"use client";\n\n`;
idx += `// AUTO-GENERATED by scripts/gen-icons.mjs — do not edit by hand.\n`;
idx += `// Drop-in animated-icon barrel. Migrate a file by changing ONLY the import source:\n`;
idx += `//   import DashboardIcon from "@mui/icons-material/Dashboard";  ->  import { DashboardIcon } from "@/components/icons";\n`;
idx += `// Shims accept MUI-style props (fontSize/color/sx/className) and follow the active color scheme.\n\n`;
idx += `import * as React from "react";\n`;
idx += `import AppIcon, { AppIconProps } from "./AppIcon";\n\n`;
idx += `export { AppIcon };\nexport type { AppIconProps };\n\n`;
idx += `type ShimProps = Omit<AppIconProps, "name">;\n`;
idx += `function makeIcon(name: string) {\n`;
idx += `  const Comp = React.forwardRef<HTMLSpanElement, ShimProps>((props, ref) => (\n`;
idx += `    <AppIcon name={name} ref={ref} {...props} />\n`;
idx += `  ));\n`;
idx += `  Comp.displayName = \`\${name}Icon\`;\n`;
idx += `  return Comp;\n`;
idx += `}\n\n`;
for (const mui of Object.keys(MAP)) {
  idx += `export const ${mui}Icon = makeIcon(${JSON.stringify(mui)});\n`;
}
fs.writeFileSync(path.join(root, "components/icons/index.tsx"), idx);

console.log(
  `Generated ${Object.keys(MAP).length} icons (${sortedAnim.length} animated, ${sortedStatic.length} static bases).`
);
