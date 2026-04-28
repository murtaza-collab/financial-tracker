import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Dropdown, DropdownItem, DropdownMenu, DropdownToggle } from 'reactstrap';
import { useAuth } from '../../context/AuthContext';

const ProfileDropdown = () => {
  const { user, signOut } = useAuth();
  const [isProfileDropdown, setIsProfileDropdown] = useState(false);

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const initials = userName.charAt(0).toUpperCase();

  const toggleProfileDropdown = () => setIsProfileDropdown(!isProfileDropdown);

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <React.Fragment>
      <Dropdown isOpen={isProfileDropdown} toggle={toggleProfileDropdown} className="ms-sm-3 header-item topbar-user">
        <DropdownToggle tag="button" type="button" className="btn">
          <span className="d-flex align-items-center">
            <span style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#405189', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 16
            }}>
              {initials}
            </span>
            <span className="text-start ms-xl-2">
              <span className="d-none d-xl-inline-block ms-1 fw-medium user-name-text">{userName}</span>
              <span className="d-none d-xl-block ms-1 fs-12 text-muted user-name-sub-text">Finance Portal</span>
            </span>
          </span>
        </DropdownToggle>
        <DropdownMenu className="dropdown-menu-end">
          <h6 className="dropdown-header">Welcome {userName}!</h6>
          <DropdownItem className="p-0">
            <Link to="/profile" className="dropdown-item">
              <i className="mdi mdi-account-circle text-muted fs-16 align-middle me-1"></i>
              <span className="align-middle">Profile</span>
            </Link>
          </DropdownItem>
          <DropdownItem className="p-0">
            <Link to="/settings/categories" className="dropdown-item">
              <i className="mdi mdi-cog-outline text-muted fs-16 align-middle me-1"></i>
              <span className="align-middle">Custom Categories</span>
            </Link>
          </DropdownItem>
          <div className="dropdown-divider"></div>
          <DropdownItem className="p-0">
            <Link to="/logout" className="dropdown-item" onClick={handleLogout}>
              <i className="mdi mdi-logout text-muted fs-16 align-middle me-1"></i>
              <span className="align-middle">Logout</span>
            </Link>
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </React.Fragment>
  );
};

export default ProfileDropdown;