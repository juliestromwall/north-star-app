import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, MapPin, Calendar, ArrowRight, DollarSign } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import PageHeader from '@/components/shared/PageHeader'
import StatusBadge from '@/components/shared/StatusBadge'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import EmptyState from '@/components/shared/EmptyState'
import { mockIntendedParents } from '@/data/mock/intendedParents'

const TYPE_STYLES = {
  'Same-sex couple': 'bg-violet-100 text-violet-800 border-violet-200',
  'Heterosexual couple': 'bg-sky-100 text-sky-800 border-sky-200',
  'Single parent': 'bg-amber-100 text-amber-800 border-amber-200',
}

export default function IPListPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')

  const filtered = useMemo(() => {
    return mockIntendedParents.filter(ip => {
      const matchesSearch = !search ||
        ip.names.toLowerCase().includes(search.toLowerCase()) ||
        ip.location.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = statusFilter === 'all' || ip.status === statusFilter
      const matchesType = typeFilter === 'all' || ip.type === typeFilter
      return matchesSearch && matchesStatus && matchesType
    })
  }, [search, statusFilter, typeFilter])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intended Parents"
        subtitle={`${mockIntendedParents.length} intended parents in program`}
        actions={
          <Button disabled className="gap-2">
            <Plus className="size-4" />
            Add Intended Parents
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Family Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Same-sex couple">Same-Sex Couple</SelectItem>
            <SelectItem value="Heterosexual couple">Heterosexual Couple</SelectItem>
            <SelectItem value="Single parent">Single Parent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No intended parents found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map(ip => (
            <Link key={ip.id} to={`/intended-parents/${ip.id}`} className="group">
              <Card className="transition-shadow hover:shadow-md h-full">
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <ProfileAvatar name={ip.names} avatar={ip.avatar} size="lg" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading font-semibold truncate">{ip.names}</h3>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                        <MapPin className="size-3.5" />
                        <span>{ip.location}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <StatusBadge status={ip.status} />
                        <Badge variant="outline" className={`text-[10px] ${TYPE_STYLES[ip.type] || ''}`}>
                          {ip.type}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Application Date</span>
                      <p className="font-medium flex items-center gap-1">
                        <Calendar className="size-3.5 text-muted-foreground" />
                        {new Date(ip.applicationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Match Stage</span>
                      <p className="font-medium">{ip.matchStage || 'Unmatched'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs">Budget</span>
                      <p className="font-medium flex items-center gap-1">
                        <DollarSign className="size-3.5 text-muted-foreground" />
                        {ip.budget}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t">
                    <span className="text-xs text-abc-indigo font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      View Profile <ArrowRight className="size-3" />
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
