// Local icon OVERRIDES — vendored animated icons in components/icons/local/.
// AppIcon consults this map FIRST, before the generated ICON_MAP. Keys are
// @mui/icons-material names (no "Icon" suffix).
//
// Source: lucide-animated.com (pqoqubbw, MIT) — vendored via
// scripts/fetch-lucide-animated.mjs (motion/react swapped to framer-motion,
// default export added). Same ref-handle API as @animateicons, so AppIcon
// renders them through its normal animated path (hover-gated + currentColor).

import type { ComponentType } from "react";

import FileText from "./local/lucide-animated/file-text";
import ReceiptText from "./local/lucide-animated/receipt-text";
import Receipt from "./local/lucide-animated/receipt";
import ClipboardCheck from "./local/lucide-animated/clipboard-check";
import Truck from "./local/lucide-animated/truck";
import Route from "./local/lucide-animated/route";
import CalendarCheck from "./local/lucide-animated/calendar-check";
import CalendarDays from "./local/lucide-animated/calendar-days";
import ArrowLeft from "./local/lucide-animated/arrow-left";
import ArrowUp from "./local/lucide-animated/arrow-up";
import ArrowDown from "./local/lucide-animated/arrow-down";
import ArrowUpRight from "./local/lucide-animated/arrow-up-right";
import ArrowRight from "./local/lucide-animated/arrow-right";
import IdCard from "./local/lucide-animated/id-card";
import Workflow from "./local/lucide-animated/workflow";
import Ban from "./local/lucide-animated/ban";
import Hourglass from "./local/lucide-animated/hourglass";
import SquarePen from "./local/lucide-animated/square-pen";
import RefreshCw from "./local/lucide-animated/refresh-cw";
import RotateCcw from "./local/lucide-animated/rotate-ccw";
import History from "./local/lucide-animated/history";
import Clock from "./local/lucide-animated/clock";
import Timer from "./local/lucide-animated/timer";
import Gauge from "./local/lucide-animated/gauge";
import ShieldCheck from "./local/lucide-animated/shield-check";
import MapPin from "./local/lucide-animated/map-pin";
import MapPinHouse from "./local/lucide-animated/map-pin-house";
import Boxes from "./local/lucide-animated/boxes";
import Construction from "./local/lucide-animated/construction";
import Flask from "./local/lucide-animated/flask";
import BriefcaseBusiness from "./local/lucide-animated/briefcase-business";
import Home from "./local/lucide-animated/home";
import SlidersHorizontal from "./local/lucide-animated/sliders-horizontal";
import CheckCheck from "./local/lucide-animated/check-check";
import CircleCheck from "./local/lucide-animated/circle-check";
import XIcon from "./local/lucide-animated/x";
import Search from "./local/lucide-animated/search";
import Layers from "./local/lucide-animated/layers";
import Copy from "./local/lucide-animated/copy";
import Play from "./local/lucide-animated/play";
import BadgePercent from "./local/lucide-animated/badge-percent";
import CircleDashed from "./local/lucide-animated/circle-dashed";
import SmartphoneNfc from "./local/lucide-animated/smartphone-nfc";
import BookText from "./local/lucide-animated/book-text";
import GitCompareArrows from "./local/lucide-animated/git-compare-arrows";
import PartyPopper from "./local/lucide-animated/party-popper";
import Mailbox from "./local/lucide-animated/mailbox";
import Archive from "./local/lucide-animated/archive";
import FolderPlus from "./local/lucide-animated/folder-plus";
import SwitchCamera from "./local/lucide-animated/switch-camera";
import BadgeAlert from "./local/lucide-animated/badge-alert";
import HandCoins from "./local/lucide-animated/hand-coins";
import HardDriveDownload from "./local/lucide-animated/hard-drive-download";
import TrainTrack from "./local/lucide-animated/train-track";
import Cog from "./local/lucide-animated/cog";
import LayoutPanelTop from "./local/lucide-animated/layout-panel-top";
import MonitorCheck from "./local/lucide-animated/monitor-check";
import Cart from "./local/lucide-animated/cart";
import Contrast from "./local/lucide-animated/contrast";
import Bookmark from "./local/lucide-animated/bookmark";
import GalleryThumbnails from "./local/lucide-animated/gallery-thumbnails";
import LayoutGrid from "./local/lucide-animated/layout-grid";
// heroicons-animated (Motion + Heroicons) — for icons lucide-animated lacked
import Printer from "./local/heroicons-animated/printer";
import Scale from "./local/heroicons-animated/scale";
import StopIcon from "./local/heroicons-animated/stop";

export const LOCAL_LUCIDE: Record<string, ComponentType<any>> = {
  // documents
  Description: FileText,
  PictureAsPdf: FileText,
  RequestPage: FileText,
  ReceiptLong: ReceiptText,
  RequestQuote: ReceiptText,
  Receipt: Receipt,
  AssignmentTurnedIn: ClipboardCheck,
  ContentPaste: Copy,
  // logistics / places
  LocalShipping: Truck,
  Route: Route,
  Map: MapPin,
  GpsFixed: MapPin,
  MyLocation: MapPin,
  LocationCity: MapPinHouse,
  Inventory: Boxes,
  Engineering: Construction,
  Science: Flask,
  Domain: BriefcaseBusiness,
  Business: BriefcaseBusiness,
  HomeWork: Home,
  Category: Layers,
  // calendar / time
  CalendarMonth: CalendarDays,
  CalendarToday: CalendarDays,
  EventNote: CalendarDays,
  EventRepeat: CalendarDays,
  EventAvailable: CalendarCheck,
  History: History,
  AccessTime: Clock,
  Pending: Clock,
  WatchLater: Clock,
  Timer: Timer,
  HourglassEmpty: Hourglass,
  PendingActions: Hourglass,
  // arrows
  ArrowBack: ArrowLeft,
  ArrowUpward: ArrowUp,
  ArrowDownward: ArrowDown,
  CallMade: ArrowUpRight,
  ArrowForward: ArrowRight,
  // actions
  Edit: SquarePen,
  EditOutlined: SquarePen,
  EditTwoTone: SquarePen,
  Refresh: RefreshCw,
  PublishedWithChanges: RefreshCw,
  RestartAlt: RotateCcw,
  CancelOutlined: XIcon,
  CancelTwoTone: XIcon,
  HighlightOff: XIcon,
  SearchOff: Search,
  FilterAlt: SlidersHorizontal,
  SelectAll: CheckCheck,
  // status / id / meters
  Speed: Gauge,
  Shield: ShieldCheck,
  VerifiedUser: ShieldCheck,
  Security: ShieldCheck,
  Verified: CircleCheck,
  Badge: IdCard,
  AccountTree: Workflow,
  Block: Ban,
  // --- similar-name / visual matches (long tail) ---
  PlayCircle: Play,
  PlayCircleOutline: Play,
  Percent: BadgePercent,
  RadioButtonUnchecked: CircleDashed,
  Android: SmartphoneNfc,
  Smartphone: SmartphoneNfc,
  Notes: BookText,
  StickyNote2Outlined: BookText,
  CompareArrows: GitCompareArrows,
  SwapHoriz: GitCompareArrows,
  CurrencyExchange: GitCompareArrows,
  EmojiEvents: PartyPopper,
  MoveToInbox: Mailbox,
  AddPhotoAlternate: GalleryThumbnails,
  DoNotDisturbOnTwoTone: Ban,
  RemoveCircleOutline: Ban,
  FilterAltOff: SlidersHorizontal,
  Warehouse: Archive,
  PhotoCamera: SwitchCamera,
  Error: BadgeAlert,
  ErrorOutline: BadgeAlert,
  ErrorOutlineTwoTone: BadgeAlert,
  Factory: Cog,
  PrecisionManufacturing: Cog,
  AccountBalance: HandCoins,
  Commute: TrainTrack,
  TableRows: LayoutPanelTop,
  ViewList: LayoutPanelTop,
  ViewKanban: LayoutGrid,
  SystemUpdate: MonitorCheck,
  AddBox: FolderPlus,
  NoteAdd: FolderPlus,
  PostAdd: FolderPlus,
  PlaylistAdd: FolderPlus,
  Save: HardDriveDownload,
  Store: Cart,
  Storefront: Cart,
  Palette: Contrast,
  LocalOffer: Bookmark,
  Flag: Bookmark,
  // heroicons-animated
  Print: Printer,
  Scale: Scale,
  Stop: StopIcon,
  // visits / routes (remapped from the CSS walk/run figures → animated route)
  DirectionsWalk: Route,
  DirectionsRun: Route,
};
