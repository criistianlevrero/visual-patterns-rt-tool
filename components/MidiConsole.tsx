
import React from 'react';
import { CloseIcon } from './icons';
import type { MidiLogEntry } from '../types';

interface MidiConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  log: MidiLogEntry[];
  onClear: () => void;
}

const MidiConsole: React.FC<MidiConsoleProps> = ({ isOpen, onClose, log, onClear }) => {
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-40 bg-gray-800/90 backdrop-blur-sm border-t border-gray-700 shadow-2xl transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ maxHeight: '40vh' }}
      aria-hidden={!isOpen}
    >
      <div className="flex flex-col h-full">
        <header className="flex items-center justify-between p-3 border-b border-gray-600 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-100">Consola MIDI</h2>
          <div className="flex items-center space-x-2">
            <button
                onClick={onClear}
                className="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 text-gray-200 rounded-md transition-colors"
                aria-label="Limpiar consola"
            >
                Limpiar
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-colors"
              aria-label="Cerrar consola"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </header>
        <div className="flex-grow p-4 overflow-y-auto font-mono text-sm">
          {log.length === 0 ? (
            <p className="text-gray-500">Esperando datos MIDI...</p>
          ) : (
            log.map((entry, index) => (
              <div key={index} className="flex items-baseline space-x-4 mb-1">
                <span className="text-gray-500">{entry.timeStamp.toString().padStart(8, ' ')}:</span>
                <p className="text-gray-300">
                  <span className="text-purple-400">[{entry.data.join(', ')}]</span>
                  <span className="ml-4 text-cyan-400">
                    Status: {entry.data[0]}, Controller: {entry.data[1]}, Value: {entry.data[2]}
                  </span>
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MidiConsole;
