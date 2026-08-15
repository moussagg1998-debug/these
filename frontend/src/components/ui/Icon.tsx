// Maps the Banani design source's `<Icon i="kebab-name" />` convention onto
// real lucide-react components. Named imports only (not the full icon map)
// so unused icons don't ship in the bundle — extend ICONS as new Banani
// screens introduce new icon names.
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Bell,
  BellOff,
  BookOpen,
  Building2,
  Calendar,
  CalendarPlus,
  CalendarX,
  Camera,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  Cloud,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  EyeOff,
  FileText,
  FileUp,
  Flag,
  GitBranch,
  GraduationCap,
  Info,
  LayoutDashboard,
  Loader2,
  Lock,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  MoreVertical,
  Paperclip,
  Pencil,
  Percent,
  Phone,
  Plus,
  Search,
  Send,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Sliders,
  Smartphone,
  Star,
  Triangle,
  Upload,
  User,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  'alert-circle': AlertCircle,
  'alert-triangle': AlertTriangle,
  archive: Archive,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'bar-chart-2': BarChart2,
  bell: Bell,
  'bell-off': BellOff,
  'book-open': BookOpen,
  'building-2': Building2,
  calendar: Calendar,
  'calendar-plus': CalendarPlus,
  'calendar-x': CalendarX,
  camera: Camera,
  check: Check,
  'check-circle': CheckCircle,
  'chevron-down': ChevronDown,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  circle: Circle,
  clock: Clock,
  cloud: Cloud,
  'credit-card': CreditCard,
  database: Database,
  download: Download,
  'external-link': ExternalLink,
  'eye-off': EyeOff,
  'file-text': FileText,
  'file-up': FileUp,
  flag: Flag,
  // lucide-react has no brand "GitHub" mark — GitBranch is the closest
  // neutral stand-in for the Admin → Monitoring GitHub card.
  github: GitBranch,
  'graduation-cap': GraduationCap,
  info: Info,
  'layout-dashboard': LayoutDashboard,
  loader: Loader2,
  lock: Lock,
  'log-in': LogIn,
  'log-out': LogOut,
  mail: Mail,
  'map-pin': MapPin,
  menu: Menu,
  'message-circle': MessageCircle,
  'message-square': MessageSquare,
  'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical,
  paperclip: Paperclip,
  pencil: Pencil,
  percent: Percent,
  phone: Phone,
  plus: Plus,
  search: Search,
  send: Send,
  server: Server,
  settings: Settings,
  shield: Shield,
  'shield-check': ShieldCheck,
  sliders: Sliders,
  smartphone: Smartphone,
  star: Star,
  triangle: Triangle,
  upload: Upload,
  user: User,
  'user-check': UserCheck,
  'user-minus': UserMinus,
  'user-plus': UserPlus,
  users: Users,
  x: X,
  zap: Zap,
};

interface IconProps {
  i: string;
  size?: number;
  className?: string | undefined;
}

// The real Google "G" mark (official 4-color SVG, same one already used in
// examples/frontend-pages/login.tsx) — not a lucide-react component, so it's
// special-cased in Icon() below rather than living in the ICONS map.
function GoogleIcon({ size, className }: { size: number; className?: string | undefined }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function Icon({ i, size = 16, className }: IconProps) {
  if (i === 'google') return <GoogleIcon size={size} className={className} />;
  const LucideComponent = ICONS[i];
  if (!LucideComponent) return null;
  return <LucideComponent size={size} className={className} aria-hidden="true" />;
}
