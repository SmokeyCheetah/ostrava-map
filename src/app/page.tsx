'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import MapLoader from '@/components/MapLoader';
import {
  getLocations,
  getReviews,
  addLocation,
  addReview,
  deleteLocation,
  updateLocation,
  deleteReview,
  addAdminReply,
  CATEGORIES,
  isSupabaseConfigured,
} from '@/lib/db';
import { supabase, LocationWithReviews, Review } from '@/lib/supabase';
import {
  Search,
  Plus,
  Star,
  MessageSquare,
  MapPin,
  ArrowLeft,
  X,
  Info,
  Camera,
  Layers,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Upload,
  AlertTriangle,
  Pencil,
  Database,
  LogIn,
  LogOut,
  User,
  CornerDownRight,
} from 'lucide-react';

interface ImageItem {
  type: 'existing' | 'new';
  url?: string;
  file?: File;
  previewUrl?: string;
}

export default function Home() {
  // App states
  const [locations, setLocations] = useState<LocationWithReviews[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationWithReviews | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pendingClick, setPendingClick] = useState<{ lat: number; lng: number } | null>(null);
  const [sidebarState, setSidebarState] = useState<'browse' | 'details' | 'add' | 'edit' | 'auth'>('browse');
  
  // Carousel active photo index state
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // Theme & sidebar collapsed state - loaded from localStorage (User Settings Only)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dbConfigured, setDbConfigured] = useState(true);

  // User Auth states
  const [user, setUser] = useState<any>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccessMessage, setAuthSuccessMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [redirectAfterAuth, setRedirectAfterAuth] = useState<'add' | 'edit' | 'browse'>('browse');

  // Drag & Drop / Upload state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Vše');
  
  // Form states - New/Edited Location (supporting up to 3 photos in Supabase Storage)
  const [newLocName, setNewLocName] = useState('');
  const [newLocDesc, setNewLocDesc] = useState('');
  const [newLocCategory, setNewLocCategory] = useState(CATEGORIES[0]);
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [urlInput, setUrlInput] = useState('');
  
  // Form states - New Review
  const [newReviewRating, setNewReviewRating] = useState<number>(5);
  const [newReviewComment, setNewReviewComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  // Delete Confirmation modal states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReviewDeleteConfirm, setShowReviewDeleteConfirm] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState<string | null>(null);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);

  // Admin Reply states
  const [replyingToReviewId, setReplyingToReviewId] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');

  // Status flags
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Load user settings and auth status on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('ostrava_map_theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    }
    const savedCollapsed = localStorage.getItem('ostrava_map_collapsed') === 'true';
    setIsSidebarCollapsed(savedCollapsed);
    
    // Check database config status
    const configured = isSupabaseConfigured();
    setDbConfigured(configured);

    if (configured) {
      // Check current session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      });

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  // Sync theme class with document root
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Load locations on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    async function loadData() {
      setLoading(true);
      try {
        const data = await getLocations();
        setLocations(data);
      } catch (err) {
        console.error('Error loading locations:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Load reviews when selected location changes
  useEffect(() => {
    async function loadReviews() {
      if (selectedLocation) {
        try {
          const revs = await getReviews(selectedLocation.id);
          setReviews(revs);
          setActiveImageIndex(0); // Reset carousel index
        } catch (err) {
          console.error('Error loading reviews:', err);
        }
      } else {
        setReviews([]);
      }
    }
    loadReviews();
  }, [selectedLocation]);

  // Filter locations based on search query and category
  const filteredLocations = useMemo(() => {
    return locations.filter((loc) => {
      const matchesSearch =
        loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (loc.description && loc.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        selectedCategory === 'Vše' || loc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [locations, searchQuery, selectedCategory]);

  // Clean up object URLs to prevent memory leaks
  const revokeImagePreviews = (items: ImageItem[]) => {
    items.forEach((item) => {
      if (item.type === 'new' && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
  };

  // Toggle user theme and store it locally
  const handleThemeToggle = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('ostrava_map_theme', newTheme);
  };

  // Toggle sidebar collapse state and store it locally
  const handleCollapseToggle = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('ostrava_map_collapsed', String(newState));
  };

  // Handle Login submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMessage('');
    setAuthLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) {
        setAuthError(error.message === 'Invalid login credentials' ? 'Nesprávný e-mail nebo heslo.' : error.message);
      } else {
        setSidebarState(redirectAfterAuth);
        setAuthEmail('');
        setAuthPassword('');
      }
    } catch (err) {
      console.error('Login error:', err);
      setAuthError('Nastala neočekávaná chyba při přihlašování.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Register submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccessMessage('');
    setAuthLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail.trim(),
        password: authPassword,
      });

      if (error) {
        setAuthError(error.message);
      } else {
        if (data.user && data.session) {
          setSidebarState(redirectAfterAuth);
          setAuthEmail('');
          setAuthPassword('');
        } else {
          setAuthSuccessMessage('Registrace byla úspěšná! Potvrďte prosím registraci ve svém e-mailu.');
          setAuthPassword('');
        }
      }
    } catch (err) {
      console.error('Registration error:', err);
      setAuthError('Nastala neočekávaná chyba při registraci.');
    } finally {
      setAuthLoading(false);
    }
  };



  // Handle Logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setSelectedLocation(null);
      setSidebarState('browse');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Handle map double click
  const handleMapClick = (lat: number, lng: number) => {
    if (!dbConfigured) return;
    if (!user) return;
    
    setPendingClick({ lat, lng });
    setSelectedLocation(null);
    revokeImagePreviews(imageItems);
    setImageItems([]);
    setUrlInput('');
    setSidebarState('add');
  };

  // Select a location and open details
  const handleSelectLocation = (loc: LocationWithReviews) => {
    const freshLoc = locations.find((l) => l.id === loc.id) || loc;
    setSelectedLocation(freshLoc);
    setPendingClick(null);
    setSidebarState('details');
  };

  // Upload all new files to Supabase Storage and collect their public URLs
  const uploadAllNewImages = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const item of imageItems) {
      if (item.type === 'existing' && item.url) {
        urls.push(item.url);
      } else if (item.type === 'new' && item.file) {
        try {
          const fileExt = item.file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          const filePath = `public/${fileName}`;

          const { error } = await supabase.storage
            .from('images')
            .upload(filePath, item.file, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) throw error;

          const { data } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

          urls.push(data.publicUrl);
        } catch (uploadErr) {
          console.error('Error uploading file to Supabase Storage:', uploadErr);
          alert('Nepodařilo se nahrát obrázek do úložiště. Ujistěte se, že máte v Supabase vytvořený veřejný (public) bucket s názvem "images" a nastavili jste zásadu (policy) pro nahrávání.');
          throw uploadErr;
        }
      }
    }
    return urls;
  };

  // Submit new location
  const handleAddLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim() || !pendingClick) return;

    setSubmitting(true);
    try {
      // 1. Upload files to Storage first
      const imageUrls = await uploadAllNewImages();

      // 2. Insert record in DB
      const added = await addLocation({
        name: newLocName,
        description: newLocDesc || null,
        latitude: pendingClick.lat,
        longitude: pendingClick.lng,
        category: newLocCategory,
        image_urls: imageUrls,
      });

      if (added) {
        const allLocs = await getLocations();
        setLocations(allLocs);
        
        const addedWithReviews = allLocs.find((l) => l.id === added.id);
        if (addedWithReviews) {
          setSelectedLocation(addedWithReviews);
          setSidebarState('details');
        } else {
          setSidebarState('browse');
        }
        
        // Reset form
        setNewLocName('');
        setNewLocDesc('');
        setNewLocCategory(CATEGORIES[0]);
        revokeImagePreviews(imageItems);
        setImageItems([]);
        setUrlInput('');
        setPendingClick(null);
      }
    } catch (err) {
      console.error('Error adding location:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit edited location data
  const handleEditLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation || !newLocName.trim()) return;

    setSubmitting(true);
    try {
      // 1. Upload new files and collect updated URLs
      const imageUrls = await uploadAllNewImages();

      // 2. Update DB entry
      const updated = await updateLocation(selectedLocation.id, {
        name: newLocName,
        description: newLocDesc || null,
        latitude: selectedLocation.latitude,
        longitude: selectedLocation.longitude,
        category: newLocCategory,
        image_urls: imageUrls,
      });

      if (updated) {
        const allLocs = await getLocations();
        setLocations(allLocs);
        
        const freshSelected = allLocs.find((l) => l.id === selectedLocation.id);
        if (freshSelected) {
          setSelectedLocation(freshSelected);
        }
        
        setSidebarState('details');
        
        // Clear fields
        setNewLocName('');
        setNewLocDesc('');
        setNewLocCategory(CATEGORIES[0]);
        revokeImagePreviews(imageItems);
        setImageItems([]);
        setUrlInput('');
      }
    } catch (err) {
      console.error('Error updating location:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Submit new review
  const handleAddReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) return;

    setSubmitting(true);
    try {
      const added = await addReview({
        location_id: selectedLocation.id,
        rating: newReviewRating,
        comment: newReviewComment.trim() || null,
      });

      if (added) {
        const allLocs = await getLocations();
        setLocations(allLocs);
        
        const freshRevs = await getReviews(selectedLocation.id);
        setReviews(freshRevs);
        
        const updatedSelected = allLocs.find((l) => l.id === selectedLocation.id);
        if (updatedSelected) {
          setSelectedLocation(updatedSelected);
        }

        setNewReviewRating(5);
        setNewReviewComment('');
      }
    } catch (err) {
      console.error('Error adding review:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger delete confirmation modal
  const handleDeleteClick = (id: string) => {
    setLocationToDelete(id);
    setShowDeleteConfirm(true);
  };

  // Perform actual deletion when confirmed
  const handleConfirmDelete = async () => {
    if (!locationToDelete) return;
    if (!isAdmin) {
      alert('Nemáte oprávnění mazat místa.');
      return;
    }
    
    try {
      const success = await deleteLocation(locationToDelete);
      if (success) {
        const allLocs = await getLocations();
        setLocations(allLocs);
        setSelectedLocation(null);
        setSidebarState('browse');
      }
    } catch (err) {
      console.error('Error deleting location:', err);
    } finally {
      setLocationToDelete(null);
      setShowDeleteConfirm(false);
    }
  };

  // Trigger review delete confirmation modal (Admin function)
  const handleReviewDeleteClick = (id: string) => {
    setReviewToDelete(id);
    setShowReviewDeleteConfirm(true);
  };

  // Perform actual review deletion when confirmed
  const handleConfirmReviewDelete = async () => {
    if (!reviewToDelete) return;
    if (!isAdmin) {
      alert('Nemáte oprávnění mazat recenze.');
      return;
    }

    try {
      const success = await deleteReview(reviewToDelete);
      if (success) {
        if (selectedLocation) {
          const freshRevs = await getReviews(selectedLocation.id);
          setReviews(freshRevs);
          
          const allLocs = await getLocations();
          setLocations(allLocs);
          const updatedSelected = allLocs.find((l) => l.id === selectedLocation.id);
          if (updatedSelected) {
            setSelectedLocation(updatedSelected);
          }
        }
      }
    } catch (err) {
      console.error('Error deleting review:', err);
    } finally {
      setReviewToDelete(null);
      setShowReviewDeleteConfirm(false);
    }
  };

  // Submit admin reply to a review
  const handleAdminReplySubmit = async (e: React.FormEvent, reviewId: string) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Nemáte oprávnění odpovídat na recenze.');
      return;
    }

    const trimmed = adminReplyText.trim();
    if (!trimmed) return;

    setSubmitting(true);
    try {
      const updatedReview = await addAdminReply(reviewId, trimmed);
      if (updatedReview) {
        if (selectedLocation) {
          const freshRevs = await getReviews(selectedLocation.id);
          setReviews(freshRevs);
        }
        setReplyingToReviewId(null);
        setAdminReplyText('');
      }
    } catch (err: any) {
      console.error('Error adding admin reply:', err?.message || err);
      alert(`Nastala chyba při ukládání odpovědi: ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete admin reply from a review
  const handleDeleteAdminReply = async (reviewId: string) => {
    if (!isAdmin) {
      alert('Nemáte oprávnění mazat odpovědi.');
      return;
    }

    if (!window.confirm('Opravdu chcete smazat tuto odpověď?')) {
      return;
    }

    setSubmitting(true);
    try {
      const updatedReview = await addAdminReply(reviewId, null);
      if (updatedReview) {
        if (selectedLocation) {
          const freshRevs = await getReviews(selectedLocation.id);
          setReviews(freshRevs);
        }
      }
    } catch (err) {
      console.error('Error deleting admin reply:', err);
      alert('Nastala chyba při mazání odpovědi.');
    } finally {
      setSubmitting(false);
    }
  };

  // Set form inputs to existing location data and change state to 'edit'
  const handleEditClick = (loc: LocationWithReviews) => {
    if (!user) {
      setRedirectAfterAuth('edit');
      setSidebarState('auth');
      setAuthError('Pro úpravu místa se musíte nejprve přihlásit.');
      return;
    }
    setNewLocName(loc.name);
    setNewLocDesc(loc.description || '');
    setNewLocCategory(loc.category);
    setImageItems((loc.image_urls || []).map((url) => ({ type: 'existing', url })));
    setUrlInput('');
    setSidebarState('edit');
  };

  // Add loaded file to upload list (limited to 3 images)
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Prosím, nahrajte platný obrázek.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Maximální velikost obrázku je 5 MB.');
      return;
    }

    setImageItems((prev) => {
      if (prev.length >= 3) return prev;
      return [
        ...prev,
        {
          type: 'new',
          file,
          previewUrl: URL.createObjectURL(file),
        },
      ];
    });
  };

  // Append photo from URL input field (limited to 3 images)
  const handleAddUrlImage = () => {
    if (!urlInput.trim()) return;
    if (imageItems.length >= 3) {
      alert('Maximální limit jsou 3 fotky.');
      return;
    }
    setImageItems((prev) => [
      ...prev,
      {
        type: 'existing',
        url: urlInput.trim(),
      },
    ]);
    setUrlInput('');
  };

  const handleCancelAdd = () => {
    setPendingClick(null);
    setSidebarState('browse');
    setNewLocName('');
    setNewLocDesc('');
    revokeImagePreviews(imageItems);
    setImageItems([]);
    setUrlInput('');
  };
  // Check if current user has the admin role (stored in app_metadata or user_metadata)
  const isAdmin = !!(user && (user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin'));

  return (
    <div className="relative w-screen h-screen flex flex-col md:flex-row overflow-hidden bg-background text-foreground transition-colors duration-300">
      
      {/* Main Map Background */}
      <div className="w-full h-full absolute inset-0 z-0">
        <MapLoader
          locations={filteredLocations}
          onMapClick={handleMapClick}
          selectedLocation={selectedLocation}
          pendingClick={pendingClick}
          onSelectLocation={handleSelectLocation}
          theme={theme}
        />
      </div>

      {/* Sidebar Panel (Floating Ostrava Glass Panel) */}
      <aside
        className={`absolute bottom-4 left-4 right-4 md:right-auto md:top-4 md:bottom-4 z-[9] w-auto md:w-[400px] max-h-[45vh] md:max-h-none flex flex-col glass-panel rounded-2xl shadow-2xl pointer-events-auto transition-transform duration-300 ${
          isSidebarCollapsed
            ? '-translate-x-[calc(100%+16px)] md:-translate-x-[416px]'
            : 'translate-x-0'
        }`}
        style={{ overflow: 'visible' }}
      >
        <div className="w-full h-full flex flex-col overflow-hidden rounded-2xl">
          
          {/* Header section with OFFICIAL OSTRAVA!!! colors */}
          <div className="p-4 border-b border-[var(--card-border)] flex items-center justify-between bg-[var(--foreground)]/5 shrink-0">
            <div className="flex flex-col">
              <div className="flex items-baseline font-black text-2xl tracking-tighter select-none">
                <span className={theme === 'dark' ? 'text-white' : 'text-[var(--ostrava-turquoise)]'}>
                  OSTRAVA
                </span>
                <span className={`font-black text-2xl tracking-tight transition-transform hover:scale-125 ml-0.5 animate-bounce ${theme === 'dark' ? 'text-[var(--ostrava-turquoise)]' : 'text-[var(--ostrava-dark-blue)]'}`} style={{ animationDelay: '0.1s' }}>!</span>
                <span className={`font-black text-2xl tracking-tight transition-transform hover:scale-125 select-none animate-bounce ${theme === 'dark' ? 'text-[var(--ostrava-turquoise)]' : 'text-[var(--ostrava-dark-blue)]'}`} style={{ animationDelay: '0.2s' }}>!</span>
                <span className={`font-black text-2xl tracking-tight transition-transform hover:scale-125 select-none animate-bounce ${theme === 'dark' ? 'text-[var(--ostrava-turquoise)]' : 'text-[var(--ostrava-dark-blue)]'}`} style={{ animationDelay: '0.3s' }}>!</span>
              </div>
              <p className="text-[10px] opacity-70 uppercase tracking-widest font-semibold mt-0.5">Komunitní mapa zajímavých míst</p>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0 relative">
              {/* User Toggle Button */}
              {dbConfigured && (
                <button
                  onClick={() => {
                    if (user) {
                      setShowUserDropdown(!showUserDropdown);
                    } else {
                      setRedirectAfterAuth('browse');
                      setAuthError('');
                      setAuthSuccessMessage('');
                      setSidebarState('auth');
                      setIsSidebarCollapsed(false);
                    }
                  }}
                  className="p-2 rounded-xl bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/70 hover:text-[var(--foreground)] transition duration-200 border border-[var(--card-border)] shadow-sm cursor-pointer relative"
                  title={user ? `Přihlášen jako ${user.email}` : 'Přihlásit se'}
                >
                  <User className="w-4 h-4" />
                  {user && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  )}
                </button>
              )}

              {/* Theme Toggle Button */}
              <button
                onClick={handleThemeToggle}
                className="p-2 rounded-xl bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)]/70 hover:text-[var(--foreground)] transition duration-200 border border-[var(--card-border)] shadow-sm cursor-pointer"
                title={theme === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-[var(--ostrava-dark-blue)]" />}
              </button>

              {/* User Dropdown Menu inside Sidebar Header */}
              {user && showUserDropdown && (
                <div className="absolute right-0 top-11 w-48 rounded-xl bg-[var(--card-bg)] border border-[var(--card-border)] shadow-xl p-2 animate-in fade-in slide-in-from-top-2 duration-150 text-xs text-[var(--foreground)] backdrop-blur-md z-[99]">
                  <div className="px-2.5 py-1.5 border-b border-[var(--card-border)] font-medium opacity-60 truncate mb-1 text-[10px]">
                    {user.email}
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition flex items-center gap-2 cursor-pointer font-bold"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Odhlásit se
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* User Auth subheader bar */}
          {dbConfigured && (
            user ? (
              <div className="px-4 py-2 bg-[var(--foreground)]/2 border-b border-[var(--card-border)] flex items-center justify-between text-[10px] font-semibold text-[var(--foreground)]/75 shrink-0">
                <div className="flex items-center gap-1.5 truncate">
                  <User className="w-3.5 h-3.5 text-[var(--ostrava-turquoise)]" />
                  <span className="truncate">{user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-rose-500 hover:text-rose-600 transition shrink-0 cursor-pointer font-bold"
                >
                  <LogOut className="w-3 h-3" />
                  Odhlásit
                </button>
              </div>
            ) : (
              <div className="px-4 py-2 bg-amber-500/5 dark:bg-amber-500/10 border-b border-[var(--card-border)] flex items-center justify-between text-[10px] font-semibold text-amber-700 dark:text-amber-300 shrink-0">
                <span className="opacity-80 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-amber-500" />
                  Přihlaste se pro přidávání míst
                </span>
                <button
                  onClick={() => {
                    setRedirectAfterAuth('browse');
                    setAuthError('');
                    setAuthSuccessMessage('');
                    setSidebarState('auth');
                  }}
                  className="flex items-center gap-1 text-[var(--ostrava-turquoise)] hover:text-[var(--primary-hover)] transition shrink-0 cursor-pointer font-bold"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Přihlásit se
                </button>
              </div>
            )
          )}

          {/* Dynamic Sidebar Body */}
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
            
            {!dbConfigured ? (
              /* Database Connection Guide Overlay (Database is production required) */
              <div className="flex flex-col flex-1 p-6 gap-4 text-center justify-center items-center">
                <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                  <Database className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--foreground)]">Připojení k databázi chybí</h2>
                  <p className="text-xs opacity-75 mt-1.5 leading-relaxed">
                    Tato komunitní mapa vyžaduje aktivní cloudovou databázi **Supabase** pro ukládání a sdílení dat.
                  </p>
                </div>
                <div className="w-full text-left bg-[var(--foreground)]/3 border border-[var(--card-border)] rounded-xl p-4 text-xs space-y-2.5 font-sans">
                  <p className="font-bold text-[var(--ostrava-turquoise)]">Postup nasazení:</p>
                  <ol className="list-decimal list-inside space-y-1.5 opacity-85">
                    <li>Založte projekt na <a href="https://supabase.com" target="_blank" className="underline font-semibold text-[var(--ostrava-turquoise)]">supabase.com</a>.</li>
                    <li>Spusťte SQL skript ze souboru <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[10px]">schema.sql</code> v SQL Editoru.</li>
                    <li>Vložte URL a API klíč do souboru <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[10px]">.env.local</code>.</li>
                    <li><strong>Vytvořte Public Bucket s názvem <code className="bg-background px-1.5 py-0.5 rounded font-mono text-[10px]">images</code></strong> v záložce Storage a nastavte policy umožňující nahrávání (upload) všem.</li>
                  </ol>
                </div>
                <p className="text-[10px] opacity-60">
                  Po konfiguraci proměnných a restartu serveru se mapa ihned zpřístupní.
                </p>
              </div>
            ) : (
              /* Standard Connected App views */
              <>
                {/* BROWSE STATE */}
                {sidebarState === 'browse' && (
                  <div className="flex flex-col flex-1 p-4 gap-4">
                    
                    {/* Search input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 opacity-50" />
                      <input
                        type="text"
                        placeholder="Hledat místo..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-background border border-[var(--card-border)] rounded-xl py-2 pl-9 pr-4 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)] transition placeholder-[var(--foreground)]/40"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-2.5 opacity-55 hover:opacity-100"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Category selector (horizontal pills for mobile / small viewports) */}
                    <div className="flex md:hidden gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-thin">
                      <button
                        onClick={() => setSelectedCategory('Vše')}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition shrink-0 ${
                          selectedCategory === 'Vše'
                            ? 'bg-[var(--ostrava-turquoise)] text-white shadow-sm font-bold'
                            : 'bg-[var(--foreground)]/5 text-[var(--foreground)] hover:bg-[var(--foreground)]/10'
                        }`}
                      >
                        Vše
                      </button>
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition shrink-0 ${
                            selectedCategory === cat
                              ? 'bg-[var(--ostrava-turquoise)] text-white shadow-sm font-bold'
                              : 'bg-[var(--foreground)]/5 text-[var(--foreground)] hover:bg-[var(--foreground)]/10'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {/* Location list */}
                    <div className="flex-1 space-y-3 min-h-0">
                      {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 opacity-60">
                          <div className="w-8 h-8 border-4 border-[var(--ostrava-turquoise)] border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs">Načítám místa...</span>
                        </div>
                      ) : filteredLocations.length === 0 ? (
                        <div className="text-center py-12 opacity-60 text-sm">
                          Nenalezena žádná místa odpovídající filtrům.
                        </div>
                      ) : (
                        filteredLocations.map((loc) => (
                          <div
                            key={loc.id}
                            onClick={() => handleSelectLocation(loc)}
                            className="group p-3.5 rounded-xl border border-[var(--card-border)] bg-[var(--foreground)]/2 hover:border-[var(--ostrava-turquoise)] hover:bg-[var(--foreground)]/5 cursor-pointer transition duration-200 flex gap-3"
                          >
                            {/* Thumbnail (renders first image) */}
                            <div className="w-16 h-16 rounded-lg bg-background flex-shrink-0 overflow-hidden relative border border-[var(--card-border)]">
                              {loc.image_urls && loc.image_urls.length > 0 ? (
                                <img
                                  src={loc.image_urls[0]}
                                  alt={loc.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center opacity-40">
                                  <Camera className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                            
                            {/* Location text details */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between gap-1">
                                  <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--ostrava-turquoise)] transition truncate">
                                    {loc.name}
                                  </h3>
                                </div>
                                <span className="inline-block text-[10px] bg-[var(--foreground)]/10 text-[var(--foreground)] font-medium px-2 py-0.5 rounded-full mt-0.5">
                                  {loc.category}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-3 text-xs mt-2 opacity-80">
                                <div className="flex items-center gap-1 text-amber-500">
                                  <Star className="w-3.5 h-3.5 fill-amber-500" />
                                  <span className="font-semibold">
                                    {loc.average_rating > 0 ? loc.average_rating : '—'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 text-[var(--foreground)]/70">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                  <span>{loc.reviews_count} recenzí</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Bottom add location prompt */}
                    {user && (
                      <div className="pt-2 shrink-0 border-t border-[var(--card-border)]">
                        <button
                          onClick={() => {
                            setSidebarState('add');
                            setPendingClick(null);
                          }}
                          className="w-full py-2.5 bg-[var(--ostrava-turquoise)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl text-sm transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Přidat nové místo
                        </button>
                        <p className="text-[10px] opacity-65 text-center mt-2 flex items-center justify-center gap-1">
                          <Info className="w-3 h-3 text-[var(--ostrava-turquoise)]" />
                          <span><span className="font-bold">Dvojklikněte</span> kamkoliv do mapy pro přidání špendlíku.</span>
                        </p>
                      </div>
                    )}

                  </div>
                )}

                {/* DETAILS STATE */}
                {sidebarState === 'details' && selectedLocation && (
                  <div className="flex flex-col flex-1">
                    
                    {/* Back to list header */}
                    <div className="p-3 bg-[var(--foreground)]/5 border-b border-[var(--card-border)] flex items-center shrink-0">
                      <button
                        onClick={() => {
                          setSelectedLocation(null);
                          setSidebarState('browse');
                        }}
                        className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]/80 hover:text-[var(--ostrava-turquoise)] transition cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Zpět na seznam
                      </button>
                    </div>

                    {/* Detail Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      
                      {/* Image Carousel (supporting up to 3 photos from Storage) */}
                      {selectedLocation.image_urls && selectedLocation.image_urls.length > 0 ? (
                        <div className="w-full h-44 rounded-xl bg-background overflow-hidden relative border border-[var(--card-border)] flex items-center justify-center group shrink-0 shadow-sm">
                          <img
                            src={selectedLocation.image_urls[activeImageIndex]}
                            alt={`${selectedLocation.name} - fotka ${activeImageIndex + 1}`}
                            className="w-full h-full object-cover transition-all duration-300"
                          />
                          
                          {/* Carousel Arrows */}
                          {selectedLocation.image_urls.length > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveImageIndex((prev) => (prev === 0 ? selectedLocation.image_urls.length - 1 : prev - 1));
                                }}
                                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition cursor-pointer hover:bg-black/80 flex items-center justify-center"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveImageIndex((prev) => (prev === selectedLocation.image_urls.length - 1 ? 0 : prev + 1));
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition cursor-pointer hover:bg-black/80 flex items-center justify-center"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                              
                              {/* Indicators / Dots */}
                              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
                                {selectedLocation.image_urls.map((_, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveImageIndex(index);
                                    }}
                                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                                      index === activeImageIndex ? 'bg-[var(--ostrava-turquoise)] scale-125' : 'bg-white/60'
                                    }`}
                                  />
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-44 rounded-xl bg-background border border-[var(--card-border)] flex flex-col items-center justify-center opacity-40 gap-1 bg-[var(--foreground)]/5 shrink-0">
                          <Camera className="w-8 h-8" />
                          <span className="text-xs">Obrázek chybí</span>
                        </div>
                      )}

                      {/* Info Card */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="text-xl font-bold text-[var(--foreground)] leading-tight">{selectedLocation.name}</h2>
                          <div className="flex items-center gap-1 shrink-0">
                            {user && (
                              <button
                                type="button"
                                onClick={() => handleEditClick(selectedLocation)}
                                className="p-1.5 rounded-lg text-[var(--foreground)] opacity-70 hover:opacity-100 hover:bg-[var(--foreground)]/10 transition cursor-pointer"
                                title="Upravit místo"
                              >
                                <Pencil className="w-4.5 h-4.5" />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteClick(selectedLocation.id)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 transition cursor-pointer"
                                title="Smazat místo"
                              >
                                <Trash2 className="w-4.5 h-4.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 items-center mt-2">
                          <span className="text-xs bg-[var(--foreground)]/10 text-[var(--foreground)] px-2 py-0.5 rounded-full font-medium">
                            {selectedLocation.category}
                          </span>
                          <span className="text-[10px] opacity-75 font-mono flex items-center gap-1 bg-[var(--foreground)]/5 px-2 py-0.5 rounded-md">
                            <MapPin className="w-3 h-3 text-[var(--ostrava-turquoise)]" />
                            {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                          </span>
                        </div>

                        {selectedLocation.description && (
                          <p className="text-sm text-[var(--foreground)]/90 mt-3 leading-relaxed whitespace-pre-line bg-[var(--foreground)]/2 p-3 rounded-xl border border-[var(--card-border)]">
                            {selectedLocation.description}
                          </p>
                        )}
                      </div>

                      {/* Reviews Section */}
                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center border-b border-[var(--card-border)] pb-2">
                          <h3 className="font-bold text-[var(--foreground)] text-sm flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4 text-[var(--ostrava-turquoise)]" />
                            Recenze ({selectedLocation.reviews_count})
                          </h3>
                          
                          {/* Aggregated Score Badge */}
                          <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-500 px-2.5 py-0.5 rounded-full text-xs font-bold border border-amber-500/20">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                            <span>{selectedLocation.average_rating > 0 ? selectedLocation.average_rating : 'Nový'}</span>
                          </div>
                        </div>

                        {/* Add Review (Auth check) */}
                        {user ? (
                          <form onSubmit={handleAddReviewSubmit} className="bg-[var(--foreground)]/2 border border-[var(--card-border)] rounded-xl p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[var(--foreground)]/80">Přidat vaše hodnocení:</span>
                              
                              {/* Interactive Stars Selection */}
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => setNewReviewRating(star)}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(null)}
                                    className="focus:outline-none transition-transform active:scale-90 cursor-pointer"
                                  >
                                    <Star
                                      className={`w-5 h-5 ${
                                        star <= (hoveredRating ?? newReviewRating)
                                          ? 'fill-amber-500 text-amber-500'
                                          : 'text-slate-300 dark:text-slate-600 hover:text-slate-400'
                                      }`}
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <textarea
                                placeholder="Napište svůj komentář nebo zkušenost..."
                                value={newReviewComment}
                                onChange={(e) => setNewReviewComment(e.target.value)}
                                rows={2}
                                className="w-full bg-background border border-[var(--card-border)] rounded-lg p-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)] placeholder-slate-400"
                              />
                              
                              <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-1.5 bg-[var(--ostrava-turquoise)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-bold rounded-lg text-xs transition shadow-sm cursor-pointer"
                              >
                                {submitting ? 'Odesílám...' : 'Odeslat recenzi'}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <div className="bg-amber-500/5 dark:bg-amber-500/10 border border-[var(--card-border)] rounded-xl p-4 text-center space-y-2">
                            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                              Chcete k tomuto místu přidat vlastní hodnocení a zkušenost?
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setRedirectAfterAuth('details');
                                setAuthError('');
                                setAuthSuccessMessage('');
                                setSidebarState('auth');
                              }}
                              className="px-4 py-1.5 bg-[var(--ostrava-turquoise)] hover:bg-[var(--primary-hover)] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm inline-block"
                            >
                              Přihlásit se k hodnocení
                            </button>
                          </div>
                        )}

                        {/* Reviews List */}
                        <div className="space-y-2.5">
                          {reviews.length === 0 ? (
                            <p className="text-xs opacity-60 text-center py-4 italic">
                              Zatím zde nejsou žádné recenze. Buďte první, kdo sem napíše hodnocení!
                            </p>
                          ) : (
                            reviews.map((rev) => (
                              <div key={rev.id} className="p-3 bg-[var(--foreground)]/2 border border-[var(--card-border)] rounded-xl space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <div className="flex gap-0.5">
                                    {[...Array(5)].map((_, i) => (
                                      <Star
                                        key={i}
                                        className={`w-3.5 h-3.5 ${
                                          i < rev.rating
                                            ? 'fill-amber-500 text-amber-500'
                                            : 'opacity-20 text-[var(--foreground)]'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] opacity-60">
                                      {new Date(rev.created_at).toLocaleDateString('cs-CZ')}
                                    </span>
                                    {isAdmin && (
                                      <button
                                        type="button"
                                        onClick={() => handleReviewDeleteClick(rev.id)}
                                        className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                                        title="Smazat recenzi"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                {rev.comment && (
                                  <p className="text-xs text-[var(--foreground)]/90 leading-relaxed font-sans pr-6">{rev.comment}</p>
                                )}

                                {/* Admin Reply Section */}
                                {rev.admin_reply ? (
                                  <div className="ml-4 mt-2 p-2.5 rounded-lg bg-[var(--foreground)]/5 border-l-2 border-[var(--ostrava-turquoise)] text-xs space-y-1 relative group/reply">
                                    <div className="flex items-center justify-between font-semibold text-[var(--ostrava-turquoise)] text-[10px] uppercase tracking-wider">
                                      <span className="flex items-center gap-1">
                                        <CornerDownRight className="w-3.5 h-3.5" />
                                        Odpověď administrátora
                                      </span>
                                      {isAdmin && (
                                        <div className="flex gap-1 opacity-0 group-hover/reply:opacity-100 transition">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setReplyingToReviewId(rev.id);
                                              setAdminReplyText(rev.admin_reply || '');
                                            }}
                                            className="p-1 text-[var(--foreground)] hover:text-[var(--ostrava-turquoise)] transition cursor-pointer"
                                            title="Upravit odpověď"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteAdminReply(rev.id)}
                                            className="p-1 text-rose-500 hover:text-rose-600 transition cursor-pointer"
                                            title="Smazat odpověď"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <p className="text-[11px] leading-relaxed whitespace-pre-line text-[var(--foreground)]/80">
                                      {rev.admin_reply}
                                    </p>
                                  </div>
                                ) : (
                                  isAdmin && replyingToReviewId !== rev.id && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyingToReviewId(rev.id);
                                        setAdminReplyText('');
                                      }}
                                      className="text-[10px] font-bold text-[var(--ostrava-turquoise)] hover:underline mt-1.5 flex items-center gap-1 cursor-pointer"
                                    >
                                      <CornerDownRight className="w-3 h-3" />
                                      Odpovědět na recenzi
                                    </button>
                                  )
                                )}

                                {/* Inline reply form */}
                                {isAdmin && replyingToReviewId === rev.id && (
                                  <form onSubmit={(e) => handleAdminReplySubmit(e, rev.id)} className="ml-4 mt-2 space-y-2">
                                    <textarea
                                      required
                                      placeholder="Napište odpověď administrátora..."
                                      value={adminReplyText}
                                      onChange={(e) => setAdminReplyText(e.target.value)}
                                      rows={2}
                                      className="w-full bg-background border border-[var(--card-border)] rounded-lg p-2 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)]"
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setReplyingToReviewId(null);
                                          setAdminReplyText('');
                                        }}
                                        className="px-2.5 py-1 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)] rounded-md text-[10px] font-semibold cursor-pointer"
                                      >
                                        Zrušit
                                      </button>
                                      <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-2.5 py-1 bg-[var(--ostrava-turquoise)] hover:bg-[var(--primary-hover)] text-white rounded-md text-[10px] font-semibold cursor-pointer shadow-sm"
                                      >
                                        Uložit
                                      </button>
                                    </div>
                                  </form>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                      </div>
                    </div>

                  </div>
                )}

                {/* ADD LOCATION STATE */}
                {sidebarState === 'add' && (
                  <form onSubmit={handleAddLocationSubmit} className="flex flex-col flex-1 p-4 gap-4">
                    
                    {/* Form title */}
                    <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-2">
                      <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-1.5">
                        <Plus className="w-4.5 h-4.5 text-[var(--ostrava-turquoise)]" />
                        Přidat nové místo
                      </h2>
                      <button
                        type="button"
                        onClick={handleCancelAdd}
                        className="opacity-60 hover:opacity-100 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Coordinates Indicator */}
                    <div className={`p-3 rounded-xl border flex flex-col gap-1.5 text-xs bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300`}>
                      <div className="flex items-center gap-1.5 font-semibold">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span>Poloha na mapě</span>
                      </div>
                      {pendingClick ? (
                        <p className="font-mono text-[10px]">
                          Lat: {pendingClick.lat.toFixed(6)}, Lng: {pendingClick.lng.toFixed(6)}
                        </p>
                      ) : (
                        <p><span className="font-bold">Dvojklikněte</span> kamkoli do mapy pro výběr souřadnic!</p>
                      )}
                    </div>

                    {/* Form inputs */}
                    <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold opacity-85">Název místa *</label>
                        <input
                          type="text"
                          required
                          placeholder="Např. Opuštěná továrna u nádraží"
                          value={newLocName}
                          onChange={(e) => setNewLocName(e.target.value)}
                          className="w-full bg-background border border-[var(--card-border)] rounded-xl py-2 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)] transition placeholder-slate-400"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold opacity-85">Kategorie</label>
                        <select
                          value={newLocCategory}
                          onChange={(e) => setNewLocCategory(e.target.value)}
                          className="w-full bg-background border border-[var(--card-border)] rounded-xl py-2 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)] transition cursor-pointer"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} className="bg-background text-[var(--foreground)]">
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold opacity-85">Popis místa</label>
                        <textarea
                          placeholder="Popište, co je na místě zajímavého, jak se tam dostat, nebo na co si dát pozor..."
                          value={newLocDesc}
                          onChange={(e) => setNewLocDesc(e.target.value)}
                          rows={3}
                          className="w-full bg-background border border-[var(--card-border)] rounded-xl py-2 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)] transition placeholder-slate-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold opacity-85">Fotografie místa (max. 3)</label>
                          <span className="text-[10px] opacity-60 font-semibold">{imageItems.length} / 3</span>
                        </div>
                        
                        {imageItems.length < 3 ? (
                          /* Drag & Drop Area */
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              if (e.dataTransfer.files) {
                                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                                const slotsLeft = 3 - imageItems.length;
                                files.slice(0, slotsLeft).forEach(f => handleImageFile(f));
                              }
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition ${
                              isDragging
                                ? 'border-[var(--ostrava-turquoise)] bg-[var(--foreground)]/5'
                                : 'border-[var(--card-border)] hover:border-[var(--ostrava-turquoise)] hover:bg-[var(--foreground)]/2'
                            }`}
                          >
                            <Upload className="w-5 h-5 text-[var(--ostrava-turquoise)] animate-pulse" />
                            <span className="text-xs font-semibold text-center text-[var(--foreground)]">
                              Přetáhněte sem fotku
                            </span>
                            <span className="text-[10px] opacity-60">nebo klikněte pro výběr</span>
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={(e) => {
                                if (e.target.files) {
                                  const files = Array.from(e.target.files);
                                  const slotsLeft = 3 - imageItems.length;
                                  files.slice(0, slotsLeft).forEach(f => handleImageFile(f));
                                }
                              }}
                              accept="image/*"
                              multiple
                              className="hidden"
                            />
                          </div>
                        ) : (
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs text-center font-semibold">
                            Uloženo maximum 3 fotografií.
                          </div>
                        )}

                        {/* Photo Previews Grid */}
                        {imageItems.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {imageItems.map((item, idx) => (
                              <div key={idx} className="relative aspect-square rounded-lg bg-background overflow-hidden border border-[var(--card-border)] group">
                                <img 
                                  src={item.type === 'existing' ? item.url : item.previewUrl} 
                                  alt="náhled" 
                                  className="w-full h-full object-cover" 
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.type === 'new' && item.previewUrl) {
                                      URL.revokeObjectURL(item.previewUrl);
                                    }
                                    setImageItems(imageItems.filter((_, i) => i !== idx));
                                  }}
                                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition rounded-lg cursor-pointer"
                                  title="Odstranit"
                                >
                                  <X className="w-4 h-4 text-rose-500" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* URL Paste field */}
                        <div className="mt-2 space-y-1.5">
                          <label className="text-[10px] opacity-60 font-semibold uppercase">Nebo přidat z URL odkazu:</label>
                          <div className="flex gap-1.5">
                            <input
                              type="url"
                              placeholder="Vložte URL adresu obrázku..."
                              value={urlInput}
                              onChange={(e) => setUrlInput(e.target.value)}
                              className="flex-1 bg-background border border-[var(--card-border)] rounded-xl py-1.5 px-3 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)]"
                            />
                            <button
                              type="button"
                              onClick={handleAddUrlImage}
                              className="px-3 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-xs font-semibold rounded-xl border border-[var(--card-border)] cursor-pointer"
                            >
                              Přidat
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="pt-2 shrink-0 border-t border-[var(--card-border)] flex gap-2">
                      <button
                        type="button"
                        onClick={handleCancelAdd}
                        className="flex-1 py-2 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)] font-semibold rounded-xl text-sm transition cursor-pointer"
                      >
                        Zrušit
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || !pendingClick}
                        className="flex-1 py-2 bg-[var(--ostrava-turquoise)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition shadow-md cursor-pointer"
                      >
                        {submitting ? 'Ukládám...' : 'Uložit místo'}
                      </button>
                    </div>

                  </form>
                )}

                {/* EDIT LOCATION STATE */}
                {sidebarState === 'edit' && selectedLocation && (
                  <form onSubmit={handleEditLocationSubmit} className="flex flex-col flex-1 p-4 gap-4">
                    
                    {/* Form title */}
                    <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-2">
                      <h2 className="text-base font-bold text-[var(--foreground)] flex items-center gap-1.5">
                        <Pencil className="w-4 h-4 text-[var(--ostrava-turquoise)]" />
                        Upravit místo
                      </h2>
                      <button
                        type="button"
                        onClick={() => setSidebarState('details')}
                        className="opacity-60 hover:opacity-100 cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Coordinates Indicator (Read-only) */}
                    <div className="p-3 rounded-xl border flex flex-col gap-1.5 text-xs bg-[var(--foreground)]/5 border-[var(--card-border)] text-[var(--foreground)]">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <MapPin className="w-4 h-4 shrink-0 text-[var(--ostrava-turquoise)]" />
                        <span>Souřadnice místa</span>
                      </div>
                      <p className="font-mono text-[10px]">
                        Lat: {selectedLocation.latitude.toFixed(6)}, Lng: {selectedLocation.longitude.toFixed(6)}
                      </p>
                    </div>

                    {/* Form inputs */}
                    <div className="space-y-3 flex-1 min-h-0 overflow-y-auto">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold opacity-85">Název místa *</label>
                        <input
                          type="text"
                          required
                          placeholder="Např. Opuštěná továrna u nádraží"
                          value={newLocName}
                          onChange={(e) => setNewLocName(e.target.value)}
                          className="w-full bg-background border border-[var(--card-border)] rounded-xl py-2 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)] transition placeholder-slate-400"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold opacity-85">Kategorie</label>
                        <select
                          value={newLocCategory}
                          onChange={(e) => setNewLocCategory(e.target.value)}
                          className="w-full bg-background border border-[var(--card-border)] rounded-xl py-2 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)] transition cursor-pointer"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat} value={cat} className="bg-background text-[var(--foreground)]">
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold opacity-85">Popis místa</label>
                        <textarea
                          placeholder="Popište, co je na místě zajímavého, jak se tam dostat, nebo na co si dát pozor..."
                          value={newLocDesc}
                          onChange={(e) => setNewLocDesc(e.target.value)}
                          rows={3}
                          className="w-full bg-background border border-[var(--card-border)] rounded-xl py-2 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)] transition placeholder-slate-400"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <label className="text-xs font-semibold opacity-85">Fotografie místa (max. 3)</label>
                          <span className="text-[10px] opacity-60 font-semibold">{imageItems.length} / 3</span>
                        </div>
                        
                        {imageItems.length < 3 ? (
                          /* Drag & Drop Area */
                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              if (e.dataTransfer.files) {
                                const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
                                const slotsLeft = 3 - imageItems.length;
                                files.slice(0, slotsLeft).forEach(f => handleImageFile(f));
                              }
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition ${
                              isDragging
                                ? 'border-[var(--ostrava-turquoise)] bg-[var(--foreground)]/5'
                                : 'border-[var(--card-border)] hover:border-[var(--ostrava-turquoise)] hover:bg-[var(--foreground)]/2'
                            }`}
                          >
                            <Upload className="w-5 h-5 text-[var(--ostrava-turquoise)] animate-pulse" />
                            <span className="text-xs font-semibold text-center text-[var(--foreground)]">
                              Přetáhněte sem fotku
                            </span>
                            <span className="text-[10px] opacity-60">nebo klikněte pro výběr</span>
                            <input
                              type="file"
                              ref={fileInputRef}
                              onChange={(e) => {
                                if (e.target.files) {
                                  const files = Array.from(e.target.files);
                                  const slotsLeft = 3 - imageItems.length;
                                  files.slice(0, slotsLeft).forEach(f => handleImageFile(f));
                                }
                              }}
                              accept="image/*"
                              multiple
                              className="hidden"
                            />
                          </div>
                        ) : (
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs text-center font-semibold">
                            Uloženo maximum 3 fotografií.
                          </div>
                        )}

                        {/* Photo Previews Grid */}
                        {imageItems.length > 0 && (
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {imageItems.map((item, idx) => (
                              <div key={idx} className="relative aspect-square rounded-lg bg-background overflow-hidden border border-[var(--card-border)] group">
                                <img 
                                  src={item.type === 'existing' ? item.url : item.previewUrl} 
                                  alt="náhled" 
                                  className="w-full h-full object-cover" 
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.type === 'new' && item.previewUrl) {
                                      URL.revokeObjectURL(item.previewUrl);
                                    }
                                    setImageItems(imageItems.filter((_, i) => i !== idx));
                                  }}
                                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition rounded-lg cursor-pointer"
                                  title="Odstranit"
                                >
                                  <X className="w-4 h-4 text-rose-500" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* URL Paste field */}
                        <div className="mt-2 space-y-1.5">
                          <label className="text-[10px] opacity-60 font-semibold uppercase">Nebo přidat z URL odkazu:</label>
                          <div className="flex gap-1.5">
                            <input
                              type="url"
                              placeholder="Vložte URL adresu obrázku..."
                              value={urlInput}
                              onChange={(e) => setUrlInput(e.target.value)}
                              className="flex-1 bg-background border border-[var(--card-border)] rounded-xl py-1.5 px-3 text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)]"
                            />
                            <button
                              type="button"
                              onClick={handleAddUrlImage}
                              className="px-3 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-xs font-semibold rounded-xl border border-[var(--card-border)] cursor-pointer"
                            >
                              Přidat
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="pt-2 shrink-0 border-t border-[var(--card-border)] flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSidebarState('details');
                          setNewLocName('');
                          setNewLocDesc('');
                          revokeImagePreviews(imageItems);
                          setImageItems([]);
                          setUrlInput('');
                        }}
                        className="flex-1 py-2 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)] font-semibold rounded-xl text-sm transition cursor-pointer"
                      >
                        Zrušit
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 py-2 bg-[var(--ostrava-turquoise)] hover:bg-[var(--primary-hover)] disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition shadow-md cursor-pointer"
                      >
                        {submitting ? 'Ukládám...' : 'Uložit změny'}
                      </button>
                    </div>

                  </form>
                )}

                {/* AUTHENTICATION STATE */}
                {sidebarState === 'auth' && (
                  <div className="flex flex-col flex-1 p-6 gap-5">
                    
                    {/* Back arrow */}
                    <div className="flex items-center justify-between border-b border-[var(--card-border)] pb-2 shrink-0">
                      <button
                        onClick={() => {
                          setSidebarState(redirectAfterAuth === 'add' || redirectAfterAuth === 'edit' ? 'browse' : redirectAfterAuth);
                          setAuthError('');
                          setAuthSuccessMessage('');
                        }}
                        className="flex items-center gap-2 text-xs font-semibold text-[var(--foreground)]/80 hover:text-[var(--ostrava-turquoise)] transition cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Zpět
                      </button>
                      <h2 className="text-sm font-bold">Přihlášení</h2>
                    </div>

                    {/* Form banner */}
                    <div className="text-center space-y-1">
                      <div className="w-10 h-10 rounded-full bg-[var(--ostrava-turquoise)]/10 text-[var(--ostrava-turquoise)] flex items-center justify-center mx-auto">
                        <User className="w-5 h-5" />
                      </div>
                      <p className="text-xs opacity-75 leading-relaxed max-w-xs mx-auto">
                        {authMode === 'login' 
                          ? 'Přihlaste se ke svému účtu pro správu zajímavých míst Ostravy.'
                          : 'Vytvořte si nový účet a podílejte se na tvorbě komunitní mapy.'}
                      </p>
                    </div>

                    {/* Mode switcher tabs */}
                    <div className="flex bg-[var(--foreground)]/5 p-1 rounded-xl border border-[var(--card-border)]">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setAuthError('');
                          setAuthSuccessMessage('');
                        }}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                          authMode === 'login'
                            ? 'bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm'
                            : 'text-[var(--foreground)]/60 hover:text-[var(--foreground)]'
                        }`}
                      >
                        Přihlásit se
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('register');
                          setAuthError('');
                          setAuthSuccessMessage('');
                        }}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                          authMode === 'register'
                            ? 'bg-[var(--card-bg)] text-[var(--foreground)] shadow-sm'
                            : 'text-[var(--foreground)]/60 hover:text-[var(--foreground)]'
                        }`}
                      >
                        Registrace
                      </button>
                    </div>

                    {/* Messages alert */}
                    {authError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-medium text-center flex items-center gap-1.5 justify-center">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{authError}</span>
                      </div>
                    )}
                    {authSuccessMessage && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium text-center">
                        {authSuccessMessage}
                      </div>
                    )}

                    {/* Form fields */}
                    <form 
                      onSubmit={authMode === 'login' ? handleLoginSubmit : handleRegisterSubmit} 
                      className="space-y-4 flex-1 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold opacity-85">E-mailová adresa</label>
                          <input
                            type="email"
                            required
                            placeholder="napriklad@ostrava.cz"
                            value={authEmail}
                            onChange={(e) => setAuthEmail(e.target.value)}
                            className="w-full bg-background border border-[var(--card-border)] rounded-xl py-2.5 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)] transition placeholder-slate-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold opacity-85">Přístupové heslo</label>
                          <input
                            type="password"
                            required
                            placeholder="••••••••"
                            value={authPassword}
                            onChange={(e) => setAuthPassword(e.target.value)}
                            className="w-full bg-background border border-[var(--card-border)] rounded-xl py-2.5 px-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--ostrava-turquoise)] transition placeholder-slate-400"
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-2.5 bg-[var(--ostrava-turquoise)] hover:bg-[var(--primary-hover)] text-white font-bold rounded-xl text-sm transition shadow-md cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                      >
                        {authLoading && (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        )}
                        <span>
                          {authMode === 'login' ? 'Přihlásit se' : 'Zaregistrovat se'}
                        </span>
                      </button>

                    </form>
                  </div>
                )}
              </>
            )}

          </div>
        </div>

        {dbConfigured && (
          /* Collapsible toggle handle - only show when database is set up */
          <button
            onClick={handleCollapseToggle}
            className="absolute top-1/2 -right-8 -translate-y-1/2 w-8 h-20 bg-[var(--card-bg)] border-y border-r border-[var(--card-border)] rounded-r-xl flex items-center justify-center cursor-pointer pointer-events-auto shadow-lg hover:text-[var(--ostrava-turquoise)] text-[var(--foreground)] backdrop-blur-md transition-colors z-[10]"
            title={isSidebarCollapsed ? "Rozbalit panel" : "Zabalit panel"}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        )}

      </aside>

      {/* Floating Category Filter Overlay (on Desktop) */}
      {dbConfigured && sidebarState === 'browse' && (
        <div 
          className={`hidden md:flex absolute top-4 z-[9] items-center gap-1.5 p-1.5 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] shadow-lg pointer-events-auto transition-all duration-300 ${
            isSidebarCollapsed ? 'left-16' : 'left-[430px]'
          }`}
        >
          <button
            onClick={() => setSelectedCategory('Vše')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
              selectedCategory === 'Vše'
                ? 'bg-[var(--ostrava-turquoise)] text-white shadow-sm'
                : 'text-[var(--foreground)]/70 hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Vše</span>
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[var(--ostrava-turquoise)] text-white shadow-sm'
                  : 'text-[var(--foreground)]/70 hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/5'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm p-6 rounded-2xl glass-panel shadow-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Smazat toto místo?</h3>
              <p className="text-xs opacity-75 leading-relaxed">
                Opravdu chcete smazat vybrané místo? Tato akce je nevratná a smaže také všechna přidružená hodnocení a komentáře.
              </p>
            </div>
            
            <div className="flex gap-2 w-full mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setLocationToDelete(null);
                }}
                className="flex-1 py-2 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)] font-semibold rounded-xl text-sm transition cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-semibold rounded-xl text-sm transition shadow-md cursor-pointer"
              >
                Smazat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Review Delete Confirmation Modal */}
      {showReviewDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div 
            className="w-full max-w-sm p-6 rounded-2xl glass-panel shadow-2xl border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--foreground)] flex flex-col items-center text-center gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-lg font-bold">Smazat tuto recenzi?</h3>
              <p className="text-xs opacity-75 leading-relaxed">
                Opravdu chcete smazat vybrané hodnocení? Tato akce je nevratná a přepočítá průměrné skóre tohoto místa.
              </p>
            </div>
            
            <div className="flex gap-2 w-full mt-2">
              <button
                type="button"
                onClick={() => {
                  setShowReviewDeleteConfirm(false);
                  setReviewToDelete(null);
                }}
                className="flex-1 py-2 bg-[var(--foreground)]/5 hover:bg-[var(--foreground)]/10 text-[var(--foreground)] font-semibold rounded-xl text-sm transition cursor-pointer"
              >
                Zrušit
              </button>
              <button
                type="button"
                onClick={handleConfirmReviewDelete}
                className="flex-1 py-2 bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white font-semibold rounded-xl text-sm transition shadow-md cursor-pointer"
              >
                Smazat
              </button>
            </div>
          </div>
        </div>
      )}


      
    </div>
  );
}
