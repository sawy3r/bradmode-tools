'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ArrowLeft, Wrench, Search, Filter, TrendingUp, Calendar, Hash, Clock, Eye } from 'lucide-react';

interface Tool {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'ready' | 'beta' | 'coming-soon';
  category: string;
  tags: string[];
  dateAdded: string;
  usageCount: number;
}

// Tool data - add new tools here
const toolsData: Tool[] = [
  {
    id: 'pay-calculator',
    name: 'Australian Pay Calculator',
    description: 'Calculate payslip amounts, tax, super, and YTD figures for Australian employees with accurate ATO rates',
    href: '/tools/pay-calculator',
    icon: ({ className }) => <div className={`${className} bg-blue-100 rounded-lg flex items-center justify-center`}>💰</div>,
    status: 'ready',
    category: 'Finance',
    tags: ['payroll', 'tax', 'australia', 'salary', 'super'],
    dateAdded: '2025-09-22',
    usageCount: 0
  },
  // Add more tools here as you build them
  // {
  //   id: 'mortgage-calculator',
  //   name: 'Mortgage Calculator',
  //   description: 'Calculate mortgage repayments, interest, and loan comparisons',
  //   href: '/tools/mortgage-calculator',
  //   icon: ({ className }) => <div className={`${className} bg-green-100 rounded-lg flex items-center justify-center`}>🏠</div>,
  //   status: 'coming-soon',
  //   category: 'Finance',
  //   tags: ['mortgage', 'loan', 'property', 'interest'],
  //   dateAdded: '2025-09-22',
  //   usageCount: 0
  // }
];

type SortOption = 'popularity' | 'name' | 'recent' | 'category';

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>(toolsData);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('popularity');
  const [showFilters, setShowFilters] = useState(false);

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(toolsData.map(tool => tool.category)))];

  // Load usage counts from localStorage on mount
  useEffect(() => {
    const savedUsage = localStorage.getItem('tool-usage-counts');
    if (savedUsage) {
      try {
        const usageCounts: Record<string, number> = JSON.parse(savedUsage);
        setTools(prevTools => 
          prevTools.map(tool => ({
            ...tool,
            usageCount: usageCounts[tool.id] || 0
          }))
        );
      } catch (error) {
        console.error('Failed to load usage counts:', error);
      }
    }
  }, []);

  // Track tool usage
  const trackToolUsage = (toolId: string) => {
    const savedUsage = localStorage.getItem('tool-usage-counts');
    let usageCounts: Record<string, number> = {};
    
    if (savedUsage) {
      try {
        usageCounts = JSON.parse(savedUsage);
      } catch (error) {
        console.error('Failed to parse usage counts:', error);
      }
    }
    
    usageCounts[toolId] = (usageCounts[toolId] || 0) + 1;
    localStorage.setItem('tool-usage-counts', JSON.stringify(usageCounts));
    
    // Update state
    setTools(prevTools => 
      prevTools.map(tool => 
        tool.id === toolId 
          ? { ...tool, usageCount: usageCounts[toolId] }
          : tool
      )
    );
  };

  // Filter and sort tools
  const filteredAndSortedTools = tools
    .filter(tool => {
      const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tool.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tool.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'all' || tool.category === selectedCategory;
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'popularity':
          return b.usageCount - a.usageCount;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'recent':
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
        case 'category':
          return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'beta':
        return 'bg-yellow-100 text-yellow-800';
      case 'coming-soon':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSortIcon = (option: SortOption) => {
    switch (option) {
      case 'popularity':
        return <TrendingUp className="w-4 h-4" />;
      case 'name':
        return <Hash className="w-4 h-4" />;
      case 'recent':
        return <Clock className="w-4 h-4" />;
      case 'category':
        return <Filter className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link href="/" className="flex items-center mr-4">
                <Wrench className="h-8 w-8 text-blue-600 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">Bradmode Tools</h1>
              </Link>
            </div>
            <nav className="flex items-center space-x-8">
              <Link 
                href="/" 
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Home
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">All Tools</h2>
          <p className="text-gray-600">
            Browse and search through all available tools and calculators
          </p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tools..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="lg:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="lg:w-48">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="popularity">Most Popular</option>
                <option value="name">Name (A-Z)</option>
                <option value="recent">Recently Added</option>
                <option value="category">Category</option>
              </select>
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden flex items-center px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </button>
          </div>

          {/* Results Count */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              {filteredAndSortedTools.length} tool{filteredAndSortedTools.length !== 1 ? 's' : ''} found
            </span>
            <div className="flex items-center gap-2">
              {getSortIcon(sortBy)}
              <span>Sorted by {sortBy === 'popularity' ? 'most popular' : sortBy}</span>
            </div>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedTools.map((tool) => {
            const IconComponent = tool.icon;
            return (
              <Link
                key={tool.id}
                href={tool.href}
                onClick={() => tool.status === 'ready' && trackToolUsage(tool.id)}
                className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200 ${
                  tool.status === 'ready' 
                    ? 'hover:border-blue-300 cursor-pointer' 
                    : 'opacity-75 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <IconComponent className="w-12 h-12" />
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(tool.status)}`}>
                      {tool.status.replace('-', ' ')}
                    </span>
                    {tool.usageCount > 0 && (
                      <div className="flex items-center text-xs text-gray-500">
                        <Eye className="w-3 h-3 mr-1" />
                        {tool.usageCount}
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {tool.name}
                </h3>
                
                <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                  {tool.description}
                </p>

                <div className="flex flex-wrap gap-1 mb-4">
                  {tool.tags.slice(0, 3).map(tag => (
                    <span 
                      key={tag}
                      className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {tool.tags.length > 3 && (
                    <span className="text-xs px-2 py-1 bg-gray-50 text-gray-500 rounded">
                      +{tool.tags.length - 3}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-blue-600 font-medium">
                    {tool.status === 'ready' ? 'Open Tool →' : 'Coming Soon'}
                  </span>
                  <span className="text-gray-400">
                    {tool.category}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Empty State */}
        {filteredAndSortedTools.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tools found</h3>
            <p className="text-gray-500 mb-4">
              Try adjusting your search or filter criteria
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
                setSortBy('popularity');
              }}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}
      </main>
    </div>
  );
}