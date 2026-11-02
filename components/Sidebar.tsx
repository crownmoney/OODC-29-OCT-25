import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  FolderPlus, 
  Plus, 
  Search, 
  Trash2, 
  Folder, 
  FileText, 
  MoreVertical, 
  Edit2, 
  X, 
  Tag, 
  Calendar,
  LogOut,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Trash,
  Undo,
  Star,
  Check,
  MoreHorizontal,
  Move
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logout } from '../services/api';
import { storageService, Scenario, Folder as FolderType } from '../services/storageService';
import { AppState } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  onLoadScenario: (data: AppState) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ appState, setAppState, onLoadScenario }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [folders, setFolders] = useState<FolderType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const s = await storageService.getScenarios();
    const f = await storageService.getFolders();
    setScenarios(s);
    setFolders(f);
  };

  const handleLogout = async () => {
    await logout();
    window.location.reload();
  };

  const filteredScenarios = useMemo(() => {
    return scenarios.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesFolder = showDeleted ? s.isDeleted : (!s.isDeleted && (activeFolderId ? s.folderId === activeFolderId : true));
      return matchesSearch && matchesFolder;
    });
  }, [scenarios, searchQuery, activeFolderId, showDeleted]);

  const handleSaveCurrent = async () => {
    const name = prompt('Enter scenario name:');
    if (!name) return;

    const newScenario: Scenario = {
      id: crypto.randomUUID(),
      name,
      data: appState,
      tags: [],
      folderId: activeFolderId,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isFavorite: false
    };

    await storageService.saveScenario(newScenario);
  };

  const handleCreateFolder = async () => {
    const name = prompt('Enter folder name:');
    if (!name) return;

    const newFolder: FolderType = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
    };

    await storageService.saveFolder(newFolder);
  };

  const handleDeleteScenario = async (id: string) => {
    if (showDeleted) {
      if (confirm('Permanently delete this scenario?')) {
        await storageService.deleteScenario(id, true);
      }
    } else {
      await storageService.deleteScenario(id);
    }
  };

  const handleRestoreScenario = async (id: string) => {
    await storageService.restoreScenario(id);
  };

  const handleToggleFavorite = async (scenario: Scenario) => {
    const updated = { ...scenario, isFavorite: !scenario.isFavorite };
    await storageService.saveScenario(updated);
  };

  const handleStartRename = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleFinishRename = async (scenario: Scenario) => {
    if (editingName.trim() && editingName !== scenario.name) {
      const updated = { ...scenario, name: editingName.trim() };
      await storageService.saveScenario(updated);
    }
    setEditingId(null);
  };

  return (
    <div className={cn(
      "fixed left-0 top-0 h-full bg-white border-r border-[#E6DEEE] transition-all duration-500 ease-in-out z-50 flex flex-col shadow-2xl",
      isOpen ? "w-80" : "w-0"
    )}>
      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "absolute -right-12 top-1/2 -translate-y-1/2 w-12 h-24 bg-white border border-l-0 border-[#E6DEEE] rounded-r-3xl flex items-center justify-center hover:bg-[#F8F8F8] transition-all shadow-xl group z-50",
          !isOpen && "right-[-48px]"
        )}
      >
        {isOpen ? (
          <ChevronLeft className="w-8 h-8 text-[#5B21B6] group-hover:scale-125 transition-transform" />
        ) : (
          <ChevronRight className="w-8 h-8 text-[#5B21B6] group-hover:scale-125 transition-transform" />
        )}
      </button>

      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col h-full"
        >
          {/* Header / User Profile */}
          <div className="p-6 border-b border-[#E6DEEE] bg-gradient-to-br from-[#F8F8F8] to-white">
            <p className="text-base font-black text-[#250B40] leading-tight">Saved Scenarios</p>
            <p className="text-[10px] text-[#583d77] font-bold uppercase tracking-widest mt-1">Stored on this device</p>
          </div>

          {/* Search & Actions */}
          <div className="p-6 space-y-5">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#583d77] group-focus-within:text-[#5B21B6] transition-colors" />
              <input 
                type="text" 
                placeholder="Search scenarios..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3.5 bg-[#F8F8F8] border border-[#d9cde5] rounded-2xl text-sm font-medium focus:ring-4 focus:ring-[#5B21B6]/10 focus:border-[#5B21B6] outline-none transition-all"
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={handleSaveCurrent}
                className="flex-1 py-4 bg-[#5B21B6] text-white rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#4c1d95] transition-all shadow-lg active:scale-95"
              >
                <Plus className="w-5 h-5" /> Save Scenario
              </button>
              <button 
                onClick={handleCreateFolder}
                className="p-4 border-2 border-[#E6DEEE] rounded-2xl hover:bg-[#F8F8F8] hover:border-[#5B21B6] transition-all active:scale-90"
                title="New Folder"
              >
                <FolderPlus className="w-5 h-5 text-[#5B21B6]" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 custom-scrollbar">
            <div className="space-y-1.5">
              <button 
                onClick={() => { setActiveFolderId(null); setShowDeleted(false); }}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-black transition-all",
                  !activeFolderId && !showDeleted ? "bg-[#5B21B6] text-white shadow-lg" : "text-[#583d77] hover:bg-[#F8F8F8]"
                )}
              >
                <FileText className="w-5 h-5" /> 
                <span className="flex-1 text-left">All Scenarios</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{scenarios.filter(s => !s.isDeleted).length}</span>
              </button>
              
              {/* Folders */}
              <div className="mt-8">
                <p className="px-4 text-[10px] font-black text-[#583d77] uppercase tracking-[0.2em] mb-3 opacity-50">Folders</p>
                <div className="space-y-1">
                  {(folders || []).map(folder => (
                    <div key={folder.id} className="group relative">
                      <button 
                        onClick={() => { setActiveFolderId(folder.id); setShowDeleted(false); }}
                        className={cn(
                          "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-black transition-all",
                          activeFolderId === folder.id ? "bg-[#E6DEEE] text-[#5B21B6]" : "text-[#583d77] hover:bg-[#F8F8F8]"
                        )}
                      >
                        {activeFolderId === folder.id ? <FolderOpen className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
                        <span className="flex-1 text-left truncate">{folder.name}</span>
                      </button>
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm('Delete this folder? Scenarios inside will be moved to "All Scenarios".')) {
                            await storageService.deleteFolder(folder.id);
                            if (activeFolderId === folder.id) setActiveFolderId(null);
                          }
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {folders.length === 0 && (
                    <p className="px-4 py-2 text-[10px] text-[#583d77] italic opacity-50">No folders created</p>
                  )}
                </div>
              </div>

              {/* Trash */}
              <button 
                onClick={() => setShowDeleted(true)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-black mt-8 transition-all",
                  showDeleted ? "bg-red-500 text-white shadow-lg" : "text-[#583d77] hover:bg-red-50 hover:text-red-600"
                )}
              >
                <Trash2 className="w-5 h-5" /> 
                <span className="flex-1 text-left">Trash</span>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full">{scenarios.filter(s => s.isDeleted).length}</span>
              </button>
            </div>

            {/* Scenarios List */}
            <div className="mt-10 border-t border-[#E6DEEE] pt-6">
              <div className="flex items-center justify-between px-4 mb-4">
                <p className="text-[10px] font-black text-[#583d77] uppercase tracking-[0.2em] opacity-50">
                  {showDeleted ? 'Recently Deleted' : 'Recent Scenarios'}
                </p>
                {!showDeleted && (
                  <button className="text-[10px] font-black text-[#5B21B6] uppercase tracking-widest hover:underline">View All</button>
                )}
              </div>
              
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {(filteredScenarios || []).map(scenario => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      key={scenario.id}
                      className={cn(
                        "group relative bg-white border border-[#E6DEEE] rounded-2xl p-4 hover:shadow-xl hover:border-[#5B21B6]/30 transition-all cursor-pointer",
                        editingId === scenario.id && "ring-2 ring-[#5B21B6]"
                      )}
                      onClick={() => editingId !== scenario.id && onLoadScenario(scenario.data)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          {editingId === scenario.id ? (
                            <input 
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() => handleFinishRename(scenario)}
                              onKeyDown={(e) => e.key === 'Enter' && handleFinishRename(scenario)}
                              className="w-full bg-[#F8F8F8] border border-[#5B21B6] rounded-lg px-2 py-1 text-sm font-bold text-[#250B40] outline-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <p className="text-sm font-black text-[#250B40] truncate pr-2">{scenario.name}</p>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleToggleFavorite(scenario); }}
                            className={cn(
                              "p-1.5 rounded-lg transition-all",
                              scenario.isFavorite ? "text-amber-500" : "text-[#583d77] opacity-0 group-hover:opacity-100 hover:bg-[#F8F8F8]"
                            )}
                          >
                            <Star className={cn("w-4 h-4", scenario.isFavorite && "fill-current")} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-3 text-[10px] text-[#583d77] font-bold uppercase tracking-widest opacity-60">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(scenario.updatedAt).toLocaleDateString()}
                        </div>
                        
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          {showDeleted ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleRestoreScenario(scenario.id); }}
                              className="p-2 hover:bg-green-50 text-green-600 rounded-xl transition-colors"
                              title="Restore"
                            >
                              <Undo className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleStartRename(scenario.id, scenario.name); }}
                                className="p-2 hover:bg-[#E6DEEE] text-[#5B21B6] rounded-xl transition-colors"
                                title="Rename"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteScenario(scenario.id); }}
                            className="p-2 hover:bg-red-50 text-red-600 rounded-xl transition-colors"
                            title={showDeleted ? "Delete Permanently" : "Move to Trash"}
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {filteredScenarios.length === 0 && (
                  <div className="text-center py-12 px-6">
                    <div className="w-16 h-16 bg-[#F8F8F8] rounded-full flex items-center justify-center mx-auto mb-4">
                      <FileText className="w-8 h-8 text-[#d9cde5]" />
                    </div>
                    <p className="text-xs text-[#583d77] font-bold uppercase tracking-widest opacity-50">No scenarios found</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer / Logout */}
          {(
            <div className="p-6 border-t border-[#E6DEEE] bg-[#F8F8F8]/50">
              <button 
                onClick={handleLogout}
                className="w-full py-4 px-6 border-2 border-red-100 text-red-600 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-red-50 hover:border-red-200 transition-all active:scale-95"
              >
                <LogOut className="w-5 h-5" /> Logout
              </button>
            </div>
          )}
        </motion.div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #E6DEEE;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #d9cde5;
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
