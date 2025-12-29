import React from 'react';

// SVG imports using vite-plugin-svgr
import FishSvg from '../../assets/icons/fish.svg?react';
import PlusSvg from '../../assets/icons/plus.svg?react';
import TrashSvg from '../../assets/icons/trash.svg?react';
import MidiSvg from '../../assets/icons/midi.svg?react';
import ConsoleSvg from '../../assets/icons/console.svg?react';
import CloseSvg from '../../assets/icons/close.svg?react';
import EnterFullscreenSvg from '../../assets/icons/enter-fullscreen.svg?react';
import ExitFullscreenSvg from '../../assets/icons/exit-fullscreen.svg?react';
import SettingsSvg from '../../assets/icons/settings.svg?react';
import ChevronDownSvg from '../../assets/icons/chevron-down.svg?react';
import DownloadSvg from '../../assets/icons/download.svg?react';
import UploadSvg from '../../assets/icons/upload.svg?react';
import DesktopSvg from '../../assets/icons/desktop.svg?react';
import MobileSvg from '../../assets/icons/mobile.svg?react';
import AspectRatioSvg from '../../assets/icons/aspect-ratio.svg?react';
import SplitSvg from '../../assets/icons/split.svg?react';
import PlaySvg from '../../assets/icons/play.svg?react';
import StopSvg from '../../assets/icons/stop.svg?react';
import SequencerSvg from '../../assets/icons/sequencer.svg?react';
import SaveSvg from '../../assets/icons/save.svg?react';
import CopySvg from '../../assets/icons/copy.svg?react';

// Wrapper components to maintain backward compatibility
export const FishIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <FishSvg {...props} />
);

export const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <PlusSvg {...props} />
);

export const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <TrashSvg {...props} />
);

export const MidiIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <MidiSvg {...props} />
);

export const ConsoleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <ConsoleSvg {...props} />
);

export const CloseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <CloseSvg {...props} />
);

export const EnterFullscreenIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <EnterFullscreenSvg {...props} />
);

export const ExitFullscreenIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <ExitFullscreenSvg {...props} />
);

export const SettingsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SettingsSvg {...props} />
);

export const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <ChevronDownSvg {...props} />
);

export const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <DownloadSvg {...props} />
);

export const UploadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <UploadSvg {...props} />
);

export const DesktopIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <DesktopSvg {...props} />
);

export const MobileIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <MobileSvg {...props} />
);

export const AspectRatioIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <AspectRatioSvg {...props} />
);

export const SplitIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SplitSvg {...props} />
);

export const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <PlaySvg {...props} />
);

export const StopIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <StopSvg {...props} />
);

export const SequencerIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SequencerSvg {...props} />
);

export const SaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <SaveSvg {...props} />
);

export const CopyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <CopySvg {...props} />
);

// Reset/Refresh icon (inline SVG)
export const ResetIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);
