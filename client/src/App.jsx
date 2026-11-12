import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DashboardLayout, PublicLayout } from './components/Layouts';
import { Loading } from './components/ui';
import { homeFor, useAuth } from './lib/auth';
import Home from './pages/public/Home';
import { About, Departments, Faq, HowItWorks } from './pages/public/Info';
import Contact from './pages/public/Contact';
import Track from './pages/public/Track';
import { Login, NotFound, Register } from './pages/public/Auth';

const CitizenDashboard = lazy(() => import('./pages/citizen/CitizenDashboard'));
const SubmitGrievance = lazy(() => import('./pages/citizen/SubmitGrievance'));
const GrievanceDetail = lazy(() => import('./pages/GrievanceDetail'));
const CmoDashboard = lazy(() => import('./pages/cmo/CmoDashboard'));
const CmoGrievances = lazy(() => import('./pages/cmo/CmoGrievances'));
const Enquiries = lazy(() => import('./pages/cmo/Enquiries'));
const OfficerDashboard = lazy(() => import('./pages/officer/OfficerDashboard'));

function RequireRole({ role, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

const guard = (role) => (
  <RequireRole role={role}><Suspense fallback={<Loading />}><DashboardLayout role={role} /></Suspense></RequireRole>
);

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />
          <Route path="how-it-works" element={<HowItWorks />} />
          <Route path="departments" element={<Departments />} />
          <Route path="faq" element={<Faq />} />
          <Route path="contact" element={<Contact />} />
          <Route path="track" element={<Track />} />
          <Route path="track/:ref" element={<Track />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>

        <Route path="citizen" element={guard('citizen')}>
          <Route index element={<CitizenDashboard />} />
          <Route path="submit" element={<SubmitGrievance />} />
          <Route path="grievances/:id" element={<GrievanceDetail />} />
        </Route>

        <Route path="cmo" element={guard('cmo_admin')}>
          <Route index element={<CmoDashboard />} />
          <Route path="grievances" element={<CmoGrievances />} />
          <Route path="grievances/:id" element={<GrievanceDetail />} />
          <Route path="enquiries" element={<Enquiries />} />
        </Route>

        <Route path="officer" element={guard('dept_officer')}>
          <Route index element={<OfficerDashboard />} />
          <Route path="grievances/:id" element={<GrievanceDetail />} />
        </Route>

        <Route element={<PublicLayout />}><Route path="*" element={<NotFound />} /></Route>
      </Routes>
    </Suspense>
  );
}
