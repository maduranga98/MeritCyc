import React, { useState } from "react";
import { Check, Plus, Trash2, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { auth, storage, functions } from "../../config/firebase";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

// Types for Onboarding Data
interface CompanyData {
  companyName: string;
  industry: string;
  size: string;
  country: string;
  currency: string;
  logoUrl?: string;
}

interface Department {
  id: string;
  name: string;
}

interface SalaryBand {
  id: string;
  name: string;
  level: number;
  min: number;
  max: number;
}

const companySchema = z.object({
  companyName: z.string().min(2, "Company Name is required"),
  industry: z.string().min(1, "Industry is required"),
  size: z.string().min(1, "Size is required"),
  country: z.string().min(1, "Country is required"),
  currency: z.string().min(1, "Currency is required"),
  logoUrl: z.string().optional(),
});

const departmentsSchema = z.object({
  departments: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, "Department name is required"),
    })
  ).min(1, "At least one department is required")
});

const salaryBandsSchema = z.object({
  salaryBands: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(1, "Band name is required"),
      level: z.coerce.number().int().positive("Level must be positive"),
      min: z.coerce.number().nonnegative(),
      max: z.coerce.number().positive(),
    })
  )
  .min(1, "At least one salary band is required")
  .refine(bands => {
    // Check if min < max for all
    return bands.every(b => b.min < b.max);
  }, { message: "Minimum salary must be less than maximum salary" })
  .refine(bands => {
    // Check unique levels
    const levels = bands.map(b => b.level);
    return new Set(levels).size === levels.length;
  }, { message: "Salary band levels must be unique" })
  .refine(bands => {
    // Check overlapping ranges
    const sorted = [...bands].sort((a, b) => a.min - b.min);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].max > sorted[i+1].min) {
        return false;
      }
    }
    return true;
  }, { message: "Salary band ranges cannot overlap" })
});

export const OnboardingWizard: React.FC = () => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [companyData, setCompanyData] = useState<CompanyData>({
    companyName: "",
    industry: "Technology",
    size: "50-100",
    country: "United States",
    currency: "USD",
    logoUrl: "",
  });

  const [departments, setDepartments] = useState<Department[]>([]);
  const [salaryBands, setSalaryBands] = useState<SalaryBand[]>([]);

  const handleNext = () => setStep((s) => Math.min(s + 1, 4));
  const handlePrev = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const completeOnboarding = httpsCallable(functions, "completeOnboarding");

      const response = await completeOnboarding({
        company: companyData,
        departments,
        salaryBands,
      });

      const data = response.data as { success: boolean; companyId?: string; error?: { message: string } };

      if (data.success) {
        toast.success("Company created successfully!");
        // Force-refresh the ID token so the freshly-set custom claims
        // (role, companyId, approved) are picked up before we land on
        // the dashboard. Without this, every Firestore query is denied.
        await auth.currentUser?.getIdToken(true);
        window.location.href = "/dashboard/super-admin";
      } else {
        toast.error(data.error?.message || "Failed to complete onboarding.");
      }
    } catch (error: unknown) {
      console.error("Onboarding Error:", error);
      toast.error(error instanceof Error ? error.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-brand">
      <div className="max-w-4xl mx-auto pt-12 pb-24 px-4 sm:px-6 lg:px-8">

        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex justify-between items-center relative">
            <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-slate-200 z-0"></div>
            <div
              className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-emerald-500 z-0 transition-all duration-300"
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            ></div>

            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 bg-white transition-colors
                  ${step >= i ? 'border-emerald-500 text-emerald-500' : 'border-slate-300 text-slate-400'}
                  ${step === i ? 'ring-4 ring-emerald-100' : ''}
                `}
              >
                {step > i ? <Check className="w-5 h-5" /> : <span className="font-semibold">{i}</span>}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 text-sm font-medium text-slate-500">
            <span>Company</span>
            <span>Departments</span>
            <span>Salary Bands</span>
            <span>Review</span>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-8">
            {step === 1 && (
              <StepCompany
                defaultValues={companyData}
                onNext={(data) => {
                  setCompanyData(data);
                  handleNext();
                }}
              />
            )}
            {step === 2 && (
              <StepDepartments
                defaultValues={{ departments }}
                onNext={(data) => {
                  setDepartments(data.departments);
                  handleNext();
                }}
                onPrev={handlePrev}
              />
            )}
            {step === 3 && (
              <StepSalaryBands
                defaultValues={{ salaryBands }}
                onNext={(data) => {
                  setSalaryBands(data.salaryBands);
                  handleNext();
                }}
                onPrev={handlePrev}
              />
            )}
            {step === 4 && (
              <StepReview
                company={companyData}
                departments={departments}
                bands={salaryBands}
                onEdit={setStep}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
                onPrev={handlePrev}
              />
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

// --- Step 1: Company ---
const StepCompany = ({ defaultValues, onNext }: { defaultValues: CompanyData, onNext: (data: CompanyData) => void }) => {
  const { register, handleSubmit, watch, setValue, formState: { errors, isValid } } = useForm<CompanyData>({
    resolver: zodResolver(companySchema),
    defaultValues,
    mode: "onChange"
  });

  const [isUploading, setIsUploading] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be less than 2MB");
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `logos/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setValue("logoUrl", url, { shouldValidate: true });
      toast.success("Logo uploaded successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload logo");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Company Details</h2>
        <p className="text-slate-500">Tell us a bit about your organization.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
            {watch("logoUrl") ? (
              <img src={watch("logoUrl")} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <span className="text-slate-400 text-xs">Logo</span>
            )}
          </div>
          <div>
            <label className="cursor-pointer bg-white px-3 py-1.5 border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50">
              {isUploading ? "Uploading..." : "Upload Logo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploading} />
            </label>
            <p className="text-xs text-slate-500 mt-1">Optional. Max 2MB (JPG/PNG).</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">Company Name *</label>
          <input
            type="text"
            {...register("companyName")}
            className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Acme Corp"
          />
          {errors.companyName && <p className="text-red-500 text-xs mt-1">{errors.companyName.message as string}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Industry *</label>
            <select
              {...register("industry")}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="Technology">Technology</option>
              <option value="Finance">Finance</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Manufacturing">Manufacturing</option>
              <option value="Retail">Retail</option>
              <option value="Education">Education</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Company Size *</label>
            <select
              {...register("size")}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="1-49">1-49</option>
              <option value="50-100">50-100</option>
              <option value="101-250">101-250</option>
              <option value="251-500">251-500</option>
              <option value="500+">500+</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Country *</label>
            <select
              {...register("country", {
                onChange: (e) => {
                  const val = e.target.value;
                  setValue("currency", val === 'United Kingdom' ? 'GBP' : val === 'Canada' ? 'CAD' : 'USD');
                }
              })}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            >
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="Canada">Canada</option>
              <option value="Australia">Australia</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Currency *</label>
            <input
              type="text"
              {...register("currency")}
              className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 uppercase"
              maxLength={3}
            />
            {errors.currency && <p className="text-red-500 text-xs mt-1">{errors.currency.message as string}</p>}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-6">
        <button
          type="submit"
          disabled={!isValid}
          className="flex items-center px-6 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50"
        >
          Next <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </form>
  );
};

// --- Step 2: Departments ---
const SUGGESTED_DEPTS = ["Engineering", "Marketing", "Sales", "HR", "Finance", "Operations"];

interface StepDepartmentsData {
  departments: Department[];
}

const StepDepartments = ({ defaultValues, onNext, onPrev }: { defaultValues: StepDepartmentsData, onNext: (data: StepDepartmentsData) => void, onPrev: () => void }) => {
  const { register, control, handleSubmit, formState: { errors, isValid } } = useForm<StepDepartmentsData>({
    resolver: zodResolver(departmentsSchema),
    defaultValues: defaultValues.departments.length > 0 ? defaultValues : { departments: [{ id: "1", name: "" }] },
    mode: "onChange"
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "departments"
  });

  const addSuggestion = (name: string) => {
    append({ id: crypto.randomUUID(), name });
  };

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Departments</h2>
        <p className="text-slate-500">Add the departments that make up your company.</p>
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-slate-700 mb-2">Suggestions:</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_DEPTS.map(dept => (
            <button
              key={dept}
              type="button"
              onClick={() => addSuggestion(dept)}
              className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
            >
              + {dept}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-center">
            <div className="flex-1">
              <input
                type="text"
                {...register(`departments.${index}.name`)}
                className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g. Engineering"
              />
              {errors.departments?.[index]?.name && <p className="text-red-500 text-xs mt-1">{errors.departments[index]?.name?.message as string}</p>}
            </div>
            {fields.length > 1 && (
              <button type="button" onClick={() => remove(index)} className="p-2 text-slate-400 hover:text-red-500">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        ))}
        {errors.departments?.root && <p className="text-red-500 text-sm mt-1">{errors.departments.root.message as string}</p>}

        <button type="button" onClick={() => append({ id: crypto.randomUUID(), name: "" })} className="flex items-center text-emerald-600 font-medium hover:text-emerald-700 text-sm py-2">
          <Plus className="w-4 h-4 mr-1" /> Add Department
        </button>
      </div>

      <div className="flex justify-between pt-6 border-t border-slate-100">
        <button type="button" onClick={onPrev} className="flex items-center px-6 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        <button type="submit" disabled={!isValid} className="flex items-center px-6 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50">
          Next <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </form>
  );
};

// --- Step 3: Salary Bands ---
const SUGGESTED_BANDS = [
  { name: "Junior (L1)", level: 1, min: 50000, max: 80000 },
  { name: "Mid (L2)", level: 2, min: 80000, max: 120000 },
  { name: "Senior (L3)", level: 3, min: 120000, max: 160000 },
  { name: "Lead (L4)", level: 4, min: 160000, max: 200000 },
  { name: "Director (L5)", level: 5, min: 200000, max: 250000 }
];

interface StepSalaryBandsData {
  salaryBands: SalaryBand[];
}

const StepSalaryBands = ({ defaultValues, onNext, onPrev }: { defaultValues: StepSalaryBandsData, onNext: (data: StepSalaryBandsData) => void, onPrev: () => void }) => {
  const { register, control, handleSubmit, getValues, formState: { errors, isValid } } = useForm<StepSalaryBandsData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(salaryBandsSchema) as any,
    defaultValues: defaultValues.salaryBands.length > 0 ? defaultValues : { salaryBands: [{ id: "1", name: "", level: 1, min: 0, max: 0 }] },
    mode: "onChange"
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "salaryBands"
  });

  const addSuggestion = (band: Omit<SalaryBand, 'id'>) => {
    append({ id: crypto.randomUUID(), name: band.name, level: band.level, min: band.min, max: band.max });
  };

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Salary Bands</h2>
        <p className="text-slate-500">Define your company's career levels and compensation ranges.</p>
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-slate-700 mb-2">Suggestions:</p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_BANDS.map((band, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => addSuggestion(band)}
              className="px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-full hover:bg-emerald-50 hover:text-emerald-600 transition-colors"
            >
              + {band.name}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-12 gap-2 px-2 text-xs font-semibold text-slate-500 uppercase">
          <div className="col-span-1">Lvl</div>
          <div className="col-span-4">Band Name</div>
          <div className="col-span-3">Min Salary</div>
          <div className="col-span-3">Max Salary</div>
          <div className="col-span-1"></div>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
            <div className="col-span-1">
              <input type="number" {...register(`salaryBands.${index}.level`, { valueAsNumber: true })} className="w-full px-2 py-2 border border-slate-300 rounded-md text-center" />
            </div>
            <div className="col-span-4">
              <input type="text" {...register(`salaryBands.${index}.name`)} placeholder="e.g. Senior" className="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div className="col-span-3">
              <input type="number" {...register(`salaryBands.${index}.min`, { valueAsNumber: true })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div className="col-span-3">
              <input type="number" {...register(`salaryBands.${index}.max`, { valueAsNumber: true })} className="w-full px-3 py-2 border border-slate-300 rounded-md" />
            </div>
            <div className="col-span-1 flex justify-center py-2">
              {fields.length > 1 && (
                <button type="button" onClick={() => remove(index)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        ))}
        {errors.salaryBands?.root && <p className="text-red-500 text-sm mt-1">{errors.salaryBands.root.message as string}</p>}
        {errors.salaryBands && Array.isArray(errors.salaryBands) && errors.salaryBands.map((err, i) => (
          <div key={i} className="text-red-500 text-xs">
            {err?.name && `Band ${i+1}: ${err.name.message}`}
            {err?.level && `Band ${i+1}: ${err.level.message}`}
            {err?.min && `Band ${i+1}: ${err.min.message}`}
            {err?.max && `Band ${i+1}: ${err.max.message}`}
          </div>
        ))}

        <button type="button" onClick={() => append({ id: crypto.randomUUID(), name: "", level: (getValues("salaryBands")?.length || 0) + 1, min: 0, max: 0 })} className="flex items-center text-emerald-600 font-medium hover:text-emerald-700 text-sm py-2">
          <Plus className="w-4 h-4 mr-1" /> Add Salary Band
        </button>
      </div>

      <div className="flex justify-between pt-6 border-t border-slate-100">
        <button type="button" onClick={onPrev} className="flex items-center px-6 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        <button type="submit" disabled={!isValid} className="flex items-center px-6 py-2 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50">
          Review <ArrowRight className="w-4 h-4 ml-2" />
        </button>
      </div>
    </form>
  );
};

// --- Step 4: Review ---
interface StepReviewProps {
  company: CompanyData;
  departments: Department[];
  bands: SalaryBand[];
  onEdit: (step: number) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  onPrev: () => void;
}

const StepReview = ({ company, departments, bands, onEdit, onSubmit, isSubmitting, onPrev }: StepReviewProps) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Review & Create</h2>
        <p className="text-slate-500">Please review your company structure before finalizing.</p>
      </div>

      <div className="space-y-6">
        {/* Company Summary */}
        <div className="border border-slate-200 rounded-lg p-5 relative">
          <button onClick={() => onEdit(1)} className="absolute top-4 right-4 text-sm text-emerald-600 hover:underline">Edit</button>
          <div className="flex items-center gap-4 mb-3 border-b border-slate-100 pb-2">
            {company.logoUrl && (
              <img src={company.logoUrl} alt="Logo" className="w-10 h-10 rounded-full object-cover border border-slate-200" />
            )}
            <h3 className="font-semibold text-slate-900">Company Details</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500 block">Name</span><span className="font-medium">{company.companyName}</span></div>
            <div><span className="text-slate-500 block">Industry</span><span className="font-medium">{company.industry}</span></div>
            <div><span className="text-slate-500 block">Location</span><span className="font-medium">{company.country} ({company.currency})</span></div>
            <div><span className="text-slate-500 block">Size</span><span className="font-medium">{company.size} employees</span></div>
          </div>
        </div>

        {/* Departments Summary */}
        <div className="border border-slate-200 rounded-lg p-5 relative">
          <button onClick={() => onEdit(2)} className="absolute top-4 right-4 text-sm text-emerald-600 hover:underline">Edit</button>
          <h3 className="font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2">Departments ({departments.length})</h3>
          <div className="flex flex-wrap gap-2">
            {departments.map((d: Department) => (
              <span key={d.id} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-sm">{d.name}</span>
            ))}
          </div>
        </div>

        {/* Bands Summary */}
        <div className="border border-slate-200 rounded-lg p-5 relative">
          <button onClick={() => onEdit(3)} className="absolute top-4 right-4 text-sm text-emerald-600 hover:underline">Edit</button>
          <h3 className="font-semibold text-slate-900 mb-3 border-b border-slate-100 pb-2">Salary Bands ({bands.length})</h3>
          <div className="space-y-2">
            {bands.map((b: SalaryBand) => (
              <div key={b.id} className="flex justify-between text-sm">
                <span className="text-slate-700"><span className="text-slate-400 mr-2">L{b.level}</span> {b.name}</span>
                <span className="font-medium text-slate-900">{company.currency} {b.min.toLocaleString()} - {b.max.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between pt-6 border-t border-slate-100">
        <button onClick={onPrev} disabled={isSubmitting} className="flex items-center px-6 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 disabled:opacity-50">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </button>
        <button onClick={onSubmit} disabled={isSubmitting} className="flex items-center px-6 py-2 bg-merit-navy text-white font-bold rounded-md hover:shadow-lg transition-all disabled:opacity-70">
          {isSubmitting ? "Creating..." : "Create Company"}
        </button>
      </div>
    </div>
  );
};

export default OnboardingWizard;
