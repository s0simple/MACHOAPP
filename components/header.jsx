export default function Header() {
  return (
    <div className="nav_wrapper">
      <div>logo</div>
      <nav>
        <li>Products</li>
        <li>Add Product</li>
        <li>About</li>
        <li>Services</li>
        <li>Contact</li>
      </nav>
      <div className="action_nav">
        <nav>
          <li>Sign in</li>
          <li>Sign up</li>
        </nav>
      </div>
    </div>
  );
}
